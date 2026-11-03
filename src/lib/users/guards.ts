import type { UserRole } from "@/lib/auth/roles";

/**
 * Why an account change was refused. The database functions in migration 0014
 * raise the same codes, so a refusal reads the same whether the check here
 * caught it first or the database did under its row locks.
 */
export const USER_ADMIN_REFUSALS = [
  "not_admin",
  "reason_required",
  "not_found",
  "unchanged",
  "self_change",
  "doctor_record",
  "invalid_role",
  "already_provisioned",
  "full_name_required",
] as const;

export type UserAdminRefusal = (typeof USER_ADMIN_REFUSALS)[number];

export const USER_ADMIN_REFUSAL_MESSAGES: Record<UserAdminRefusal, string> = {
  not_admin: "Only an active administrator can manage accounts.",
  reason_required: "Enter a reason for this change.",
  not_found: "That account no longer exists.",
  unchanged: "Nothing to change.",
  self_change:
    "You cannot change your own role or status. Ask another administrator.",
  doctor_record:
    "This account has a doctor record. Manage it from the Doctors section.",
  invalid_role: "Choose a staff role.",
  already_provisioned: "This account is already set up.",
  full_name_required: "Enter the full name.",
};

export function refusalFromCode(code: string | undefined | null): UserAdminRefusal | null {
  return USER_ADMIN_REFUSALS.find((refusal) => refusal === code) ?? null;
}

type ManagedAccount = {
  id: string;
  role: UserRole;
  isActive: boolean;
  hasDoctorRecord: boolean;
};

/**
 * Guard rails for a role change, in the order the database checks them. The
 * last active admin is protected by the self-change rule: the actor is an
 * active admin who cannot target themselves, so another active admin always
 * remains.
 */
export function checkRoleChange({
  actorId,
  target,
  newRole,
}: {
  actorId: string;
  target: ManagedAccount;
  newRole: UserRole;
}): UserAdminRefusal | null {
  if (target.role === newRole) return "unchanged";
  if (target.id === actorId) return "self_change";
  if (target.hasDoctorRecord) return "doctor_record";
  return null;
}

/** Guard rails for activating or deactivating an account. */
export function checkActiveChange({
  actorId,
  target,
  isActive,
}: {
  actorId: string;
  target: ManagedAccount;
  isActive: boolean;
}): UserAdminRefusal | null {
  if (target.isActive === isActive) return "unchanged";
  if (target.id === actorId) return "self_change";
  return null;
}
