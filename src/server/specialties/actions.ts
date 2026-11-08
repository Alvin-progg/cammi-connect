"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { specialtyFormSchema } from "@/lib/specialties/schemas";
import { getAdminSession } from "@/server/auth/dal";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";

import { supabaseSpecialtyAdminRepository } from "./repository";
import { saveSpecialty, setSpecialtyActive } from "./service";

export type SpecialtyActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const SPECIALTIES_PATH = "/admin/specialties";

const NOT_AUTHORIZED: SpecialtyActionState = {
  status: "error",
  message: "You are not authorized to manage specialties.",
};

const INVALID_SPECIALTY: SpecialtyActionState = {
  status: "error",
  message: "That specialty is not valid.",
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
  const session = await getAdminSession(SPECIALTIES_PATH);
  return session?.admin.id ?? null;
}

/** Doctors and the other admin pages show specialty names and status. */
function refreshAdmin() {
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
}

export async function saveSpecialtyAction(
  _previous: SpecialtyActionState,
  formData: FormData,
): Promise<SpecialtyActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const rawId = text(formData, "specialtyId")?.trim() || null;
  const specialtyId = rawId === null ? null : z.uuid().safeParse(rawId).data;
  if (specialtyId === undefined) {
    return INVALID_SPECIALTY;
  }
  const parsed = specialtyFormSchema.safeParse({
    name: text(formData, "name") ?? "",
    description: text(formData, "description"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const result = await saveSpecialty(
    { actorId, specialtyId, input: parsed.data },
    supabaseSpecialtyAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  refreshAdmin();
  if (specialtyId === null) {
    redirect(`${SPECIALTIES_PATH}/${result.specialtyId}`);
  }
  return { status: "success", message: result.message };
}

export async function setSpecialtyActiveAction(
  _previous: SpecialtyActionState,
  formData: FormData,
): Promise<SpecialtyActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const specialtyId = z.uuid().safeParse(text(formData, "specialtyId"));
  const isActive = z.stringbool().safeParse(text(formData, "isActive"));
  if (!specialtyId.success || !isActive.success) {
    return INVALID_SPECIALTY;
  }

  const result = await setSpecialtyActive(
    { actorId, specialtyId: specialtyId.data, isActive: isActive.data },
    supabaseSpecialtyAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  refreshAdmin();
  return { status: "success", message: result.message };
}
