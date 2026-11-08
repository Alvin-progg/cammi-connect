"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  activeChangeSchema,
  profileUpdateSchema,
  roleChangeSchema,
  staffInviteSchema,
} from "@/lib/users/schemas";
import { supabaseAuditLogRepository } from "@/server/audit/repository";
import { getAdminSession } from "@/server/auth/dal";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";

import { supabaseUserAdminRepository } from "./repository";
import {
  changeUserRole,
  inviteStaff,
  sendUserPasswordReset,
  setUserActive,
  updateUserProfile,
  type UserAdminResult,
} from "./service";

export type UserAdminActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const USERS_PATH = "/admin/users";

const NOT_AUTHORIZED: UserAdminActionState = {
  status: "error",
  message: "You are not authorized to manage accounts.",
};

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form values.";
}

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

/** The acting admin's profile ID, always from the session and never from the form. */
async function requireAdminActor(): Promise<string | null> {
  const session = await getAdminSession(USERS_PATH);
  return session?.admin.id ?? null;
}

function toActionState(result: UserAdminResult): UserAdminActionState {
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath(USERS_PATH, "layout");
  return { status: "success", message: result.message };
}

export async function inviteStaffAction(
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const parsed = staffInviteSchema.safeParse({
    email: text(formData, "email") ?? "",
    fullName: text(formData, "fullName") ?? "",
    role: text(formData, "role"),
    phone: text(formData, "phone"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const result = await inviteStaff(
    { actorId, input: parsed.data },
    supabaseUserAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath(USERS_PATH, "layout");
  redirect(`${USERS_PATH}/${result.profileId}`);
}

export async function changeUserRoleAction(
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const parsed = roleChangeSchema.safeParse({
    profileId: text(formData, "profileId"),
    role: text(formData, "role"),
    reason: text(formData, "reason") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  return toActionState(
    await changeUserRole({ actorId, ...parsed.data }, supabaseUserAdminRepository),
  );
}

export async function setUserActiveAction(
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const parsed = activeChangeSchema.safeParse({
    profileId: text(formData, "profileId"),
    isActive: z.stringbool().safeParse(text(formData, "isActive")).data,
    reason: text(formData, "reason") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  return toActionState(
    await setUserActive({ actorId, ...parsed.data }, supabaseUserAdminRepository),
  );
}

export async function updateUserProfileAction(
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const parsed = profileUpdateSchema.safeParse({
    profileId: text(formData, "profileId"),
    fullName: text(formData, "fullName") ?? "",
    phone: text(formData, "phone"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  return toActionState(
    await updateUserProfile({ actorId, ...parsed.data }, supabaseUserAdminRepository),
  );
}

export async function sendPasswordResetAction(
  _previous: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const profileId = z.uuid().safeParse(text(formData, "profileId"));
  if (!profileId.success) {
    return { status: "error", message: "That account is not valid." };
  }

  return toActionState(
    await sendUserPasswordReset(
      { actorId, profileId: profileId.data },
      supabaseUserAdminRepository,
      supabaseAuditLogRepository,
    ),
  );
}
