"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirementFormSchema, supersedeRequirementSchema } from "@/lib/requirements/schemas";
import { getAdminSession } from "@/server/auth/dal";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";

import { supabaseRequirementAdminRepository } from "./repository";
import {
  archiveRequirement,
  publishRequirement,
  saveRequirement,
  supersedeRequirement,
} from "./service";

export type RequirementActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const REQUIREMENTS_PATH = "/admin/requirements";

const NOT_AUTHORIZED: RequirementActionState = {
  status: "error",
  message: "You are not authorized to manage requirements.",
};

const INVALID_REQUIREMENT: RequirementActionState = {
  status: "error",
  message: "That requirement is not valid.",
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
  const session = await getAdminSession(REQUIREMENTS_PATH);
  return session?.admin.id ?? null;
}

function requirementIdFrom(formData: FormData): string | null {
  return z.uuid().safeParse(text(formData, "requirementId")).data ?? null;
}

export async function saveRequirementAction(
  _previous: RequirementActionState,
  formData: FormData,
): Promise<RequirementActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const rawId = text(formData, "requirementId")?.trim() || null;
  const requirementId = rawId === null ? null : z.uuid().safeParse(rawId).data;
  if (requirementId === undefined) {
    return INVALID_REQUIREMENT;
  }
  const parsed = requirementFormSchema.safeParse({
    title: text(formData, "title") ?? "",
    description: text(formData, "description"),
    target: text(formData, "target") ?? "",
    isMandatory: text(formData, "isMandatory"),
    effectiveFrom: text(formData, "effectiveFrom") ?? "",
    effectiveTo: text(formData, "effectiveTo"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const result = await saveRequirement(
    { actorId, requirementId, input: parsed.data },
    supabaseRequirementAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
  if (requirementId === null) {
    redirect(`${REQUIREMENTS_PATH}/${result.requirementId}`);
  }
  return { status: "success", message: result.message };
}

export async function publishRequirementAction(
  _previous: RequirementActionState,
  formData: FormData,
): Promise<RequirementActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const requirementId = requirementIdFrom(formData);
  if (!requirementId) {
    return INVALID_REQUIREMENT;
  }

  const result = await publishRequirement(
    { actorId, requirementId },
    supabaseRequirementAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
  return { status: "success", message: result.message };
}

export async function archiveRequirementAction(
  _previous: RequirementActionState,
  formData: FormData,
): Promise<RequirementActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const requirementId = requirementIdFrom(formData);
  if (!requirementId) {
    return INVALID_REQUIREMENT;
  }

  const result = await archiveRequirement(
    { actorId, requirementId },
    supabaseRequirementAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
  return { status: "success", message: result.message };
}

export async function supersedeRequirementAction(
  _previous: RequirementActionState,
  formData: FormData,
): Promise<RequirementActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const requirementId = requirementIdFrom(formData);
  if (!requirementId) {
    return INVALID_REQUIREMENT;
  }
  const parsed = supersedeRequirementSchema.safeParse({
    startsOn: text(formData, "startsOn") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const result = await supersedeRequirement(
    { actorId, requirementId, startsOn: parsed.data.startsOn },
    supabaseRequirementAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
  redirect(`${REQUIREMENTS_PATH}/${result.requirementId}`);
}
