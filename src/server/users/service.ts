import "server-only";

import type { UserRole } from "@/lib/auth/roles";
import {
  checkActiveChange,
  checkRoleChange,
  refusalFromCode,
  USER_ADMIN_REFUSAL_MESSAGES,
} from "@/lib/users/guards";
import type { StaffInviteInput } from "@/lib/users/schemas";
import {
  USERS_PAGE_SIZE,
  type AdminUserDetail,
  type AdminUserRow,
  type StaffRole,
  type UserActivityEntry,
  type UserListFilters,
} from "@/lib/users/types";
import { recordAdminAudit, type AuditLogWriter } from "@/server/audit/service";

/** A database function call; `code` is the P0001 refusal message, if any. */
export type DatabaseOutcome = { ok: true } | { ok: false; code: string | undefined };

export type ManagedUser = AdminUserDetail & { authUserId: string };

/**
 * Data access for admin account management. Callers authorize first: every
 * method is admin-only, and `actorId` must come from the admin session.
 */
export type UserAdminStore = {
  listUsers(query: {
    search: string | null;
    role: UserRole | null;
    isActive: boolean | null;
    limit: number;
    offset: number;
  }): Promise<{ users: AdminUserRow[]; total: number }>;
  getUser(profileId: string): Promise<ManagedUser | null>;
  listActivity(profileId: string, limit: number): Promise<UserActivityEntry[]>;
  /** Sends a Supabase Auth invite; the user sets their own password. */
  inviteUser(input: {
    email: string;
    fullName: string;
  }): Promise<{ ok: true; authUserId: string } | { ok: false; code: string | undefined }>;
  provisionStaff(input: {
    actorId: string;
    authUserId: string;
    role: StaffRole;
    fullName: string;
    phone: string | null;
  }): Promise<{ ok: true; profileId: string } | { ok: false; code: string | undefined }>;
  setRole(input: {
    actorId: string;
    profileId: string;
    role: UserRole;
    reason: string;
  }): Promise<DatabaseOutcome>;
  setActive(input: {
    actorId: string;
    profileId: string;
    isActive: boolean;
    reason: string;
  }): Promise<DatabaseOutcome>;
  updateProfile(input: {
    actorId: string;
    profileId: string;
    fullName: string;
    phone: string | null;
  }): Promise<DatabaseOutcome>;
  /** Bans or unbans the auth user so existing and new sign-ins stop working. Returns false on failure. */
  setSignInBlocked(authUserId: string, blocked: boolean): Promise<boolean>;
  /** Returns false when the email could not be sent. */
  sendPasswordReset(email: string): Promise<boolean>;
};

export type UserAdminResult = { ok: true; message: string } | { ok: false; message: string };

const GENERIC_FAILURE = "Something went wrong. Try again.";
const ACTIVITY_LIMIT = 20;

const INVITE_FAILURE_MESSAGES: Record<string, string> = {
  email_exists: "An account with this email already exists.",
  user_already_exists: "An account with this email already exists.",
  over_email_send_rate_limit: "Too many emails were sent. Try again later.",
};

function refusalMessage(code: string | undefined): string {
  const refusal = refusalFromCode(code);
  return refusal ? USER_ADMIN_REFUSAL_MESSAGES[refusal] : GENERIC_FAILURE;
}

function toResult(outcome: DatabaseOutcome, successMessage: string): UserAdminResult {
  return outcome.ok
    ? { ok: true, message: successMessage }
    : { ok: false, message: refusalMessage(outcome.code) };
}

export async function listUsers(filters: UserListFilters, store: UserAdminStore) {
  const { users, total } = await store.listUsers({
    search: filters.search || null,
    role: filters.role,
    isActive: filters.status === null ? null : filters.status === "active",
    limit: USERS_PAGE_SIZE,
    offset: (filters.page - 1) * USERS_PAGE_SIZE,
  });
  return {
    users,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
  };
}

export async function getUserDetail(
  profileId: string,
  store: UserAdminStore,
): Promise<{ user: ManagedUser; activity: UserActivityEntry[] } | null> {
  const user = await store.getUser(profileId);
  if (!user) {
    return null;
  }
  return { user, activity: await store.listActivity(profileId, ACTIVITY_LIMIT) };
}

/**
 * Invites a staff member. Supabase Auth creates the user (and the database
 * trigger a patient profile); provisioning then turns that profile into staff
 * and writes the audit row. The two steps cannot share a transaction, so a
 * provisioning failure says so and how to finish the setup.
 */
export async function inviteStaff(
  { actorId, input }: { actorId: string; input: StaffInviteInput },
  store: UserAdminStore,
): Promise<{ ok: true; profileId: string } | { ok: false; message: string }> {
  const invite = await store.inviteUser({ email: input.email, fullName: input.fullName });
  if (!invite.ok) {
    return {
      ok: false,
      message:
        (invite.code && INVITE_FAILURE_MESSAGES[invite.code]) ||
        "The invitation could not be sent. Try again.",
    };
  }

  const provisioned = await store.provisionStaff({
    actorId,
    authUserId: invite.authUserId,
    role: input.role,
    fullName: input.fullName,
    phone: input.phone,
  });
  if (!provisioned.ok) {
    return {
      ok: false,
      message: `The invitation was sent, but the account could not be set up as staff (${refusalMessage(provisioned.code)}) Find it in Users and change its role.`,
    };
  }
  return { ok: true, profileId: provisioned.profileId };
}

export async function changeUserRole(
  input: { actorId: string; profileId: string; role: UserRole; reason: string },
  store: UserAdminStore,
): Promise<UserAdminResult> {
  const target = await store.getUser(input.profileId);
  if (!target) {
    return { ok: false, message: USER_ADMIN_REFUSAL_MESSAGES.not_found };
  }
  const refusal = checkRoleChange({ actorId: input.actorId, target, newRole: input.role });
  if (refusal) {
    return { ok: false, message: USER_ADMIN_REFUSAL_MESSAGES[refusal] };
  }
  return toResult(await store.setRole(input), "Role updated.");
}

/**
 * Activates or deactivates an account. Sign-in access changes first, so a
 * failure at either step leaves a state the admin can simply retry; if the
 * database then refuses, sign-in access is put back. The DAL also denies
 * inactive profiles, so the database flag is what protects every dashboard.
 */
export async function setUserActive(
  input: { actorId: string; profileId: string; isActive: boolean; reason: string },
  store: UserAdminStore,
): Promise<UserAdminResult> {
  const target = await store.getUser(input.profileId);
  if (!target) {
    return { ok: false, message: USER_ADMIN_REFUSAL_MESSAGES.not_found };
  }
  const refusal = checkActiveChange({
    actorId: input.actorId,
    target,
    isActive: input.isActive,
  });
  if (refusal) {
    return { ok: false, message: USER_ADMIN_REFUSAL_MESSAGES[refusal] };
  }

  const blocked = !input.isActive;
  if (!(await store.setSignInBlocked(target.authUserId, blocked))) {
    return { ok: false, message: "Sign-in access could not be updated. Nothing was changed." };
  }

  const outcome = await store.setActive(input);
  if (!outcome.ok) {
    await store.setSignInBlocked(target.authUserId, !blocked);
  }
  return toResult(outcome, input.isActive ? "Account activated." : "Account deactivated.");
}

export async function updateUserProfile(
  input: { actorId: string; profileId: string; fullName: string; phone: string | null },
  store: UserAdminStore,
): Promise<UserAdminResult> {
  return toResult(await store.updateProfile(input), "Profile saved.");
}

/** Sends a Supabase password reset email. The admin never sees or sets the password. */
export async function sendUserPasswordReset(
  input: { actorId: string; profileId: string },
  store: UserAdminStore,
  audit: AuditLogWriter,
): Promise<UserAdminResult> {
  const target = await store.getUser(input.profileId);
  if (!target?.email) {
    return { ok: false, message: USER_ADMIN_REFUSAL_MESSAGES.not_found };
  }
  if (!(await store.sendPasswordReset(target.email))) {
    return { ok: false, message: "The reset email could not be sent. Try again later." };
  }

  await recordAdminAudit(
    {
      actorProfileId: input.actorId,
      action: "user.password_reset_requested",
      targetType: "user",
      targetId: target.id,
    },
    audit,
  );
  return { ok: true, message: "Password reset email sent." };
}
