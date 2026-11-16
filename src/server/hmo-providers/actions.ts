"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { hmoProviderFormSchema } from "@/lib/hmo-providers/schemas";
import { getAdminSession } from "@/server/auth/dal";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";

import { supabaseHmoProviderAdminRepository } from "./repository";
import { saveHmoProvider, setHmoProviderActive } from "./service";

export type HmoProviderActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const HMO_PROVIDERS_PATH = "/admin/hmo-providers";

const NOT_AUTHORIZED: HmoProviderActionState = {
  status: "error",
  message: "You are not authorized to manage HMO providers.",
};

const INVALID_HMO_PROVIDER: HmoProviderActionState = {
  status: "error",
  message: "That HMO provider is not valid.",
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
  const session = await getAdminSession(HMO_PROVIDERS_PATH);
  return session?.admin.id ?? null;
}

function refreshAdmin() {
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
}

export async function saveHmoProviderAction(
  _previous: HmoProviderActionState,
  formData: FormData,
): Promise<HmoProviderActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const rawId = text(formData, "hmoProviderId")?.trim() || null;
  const hmoProviderId = rawId === null ? null : z.uuid().safeParse(rawId).data;
  if (hmoProviderId === undefined) {
    return INVALID_HMO_PROVIDER;
  }
  const parsed = hmoProviderFormSchema.safeParse({
    name: text(formData, "name") ?? "",
    copayCentavos: text(formData, "copay"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const result = await saveHmoProvider(
    { actorId, hmoProviderId, input: parsed.data },
    supabaseHmoProviderAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  refreshAdmin();
  if (hmoProviderId === null) {
    redirect(`${HMO_PROVIDERS_PATH}/${result.hmoProviderId}`);
  }
  return { status: "success", message: result.message };
}

export async function setHmoProviderActiveAction(
  _previous: HmoProviderActionState,
  formData: FormData,
): Promise<HmoProviderActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const hmoProviderId = z.uuid().safeParse(text(formData, "hmoProviderId"));
  const isActive = z.stringbool().safeParse(text(formData, "isActive"));
  if (!hmoProviderId.success || !isActive.success) {
    return INVALID_HMO_PROVIDER;
  }

  const result = await setHmoProviderActive(
    { actorId, hmoProviderId: hmoProviderId.data, isActive: isActive.data },
    supabaseHmoProviderAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  refreshAdmin();
  return { status: "success", message: result.message };
}
