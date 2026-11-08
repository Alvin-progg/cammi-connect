"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { serviceFormSchema } from "@/lib/services/schemas";
import { getAdminSession } from "@/server/auth/dal";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";

import { supabaseServiceAdminRepository } from "./repository";
import { saveService, setServiceActive } from "./service";

export type ServiceActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const SERVICES_PATH = "/admin/services";

const NOT_AUTHORIZED: ServiceActionState = {
  status: "error",
  message: "You are not authorized to manage services.",
};

const INVALID_SERVICE: ServiceActionState = {
  status: "error",
  message: "That service is not valid.",
};

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form values.";
}

/** The acting admin's profile ID, always from the session and never from the form. */
async function requireAdminActor(): Promise<string | null> {
  const session = await getAdminSession(SERVICES_PATH);
  return session?.admin.id ?? null;
}

export async function saveServiceAction(
  _previous: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const rawId = text(formData, "serviceId")?.trim() || null;
  const serviceId = rawId === null ? null : z.uuid().safeParse(rawId).data;
  if (serviceId === undefined) {
    return INVALID_SERVICE;
  }
  const parsed = serviceFormSchema.safeParse({
    name: text(formData, "name") ?? "",
    description: text(formData, "description"),
    departmentId: text(formData, "departmentId"),
    requiresAppointment: text(formData, "requiresAppointment"),
    bookingMode: text(formData, "bookingMode") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const result = await saveService(
    { actorId, serviceId, input: parsed.data },
    supabaseServiceAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
  if (serviceId === null) {
    redirect(`${SERVICES_PATH}/${result.serviceId}`);
  }
  return { status: "success", message: result.message };
}

export async function setServiceActiveAction(
  _previous: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const serviceId = z.uuid().safeParse(text(formData, "serviceId"));
  const isActive = z.stringbool().safeParse(text(formData, "isActive"));
  if (!serviceId.success || !isActive.success) {
    return INVALID_SERVICE;
  }

  const result = await setServiceActive(
    { actorId, serviceId: serviceId.data, isActive: isActive.data },
    supabaseServiceAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
  return { status: "success", message: result.message };
}
