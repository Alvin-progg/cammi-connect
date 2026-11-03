import type { UserRole } from "@/lib/auth/roles";

/** Roles an admin can give a new account. Patients register themselves. */
export const STAFF_ROLES = ["front_desk", "doctor", "admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const USER_STATUS_FILTERS = ["active", "inactive"] as const;

export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

export const USERS_PAGE_SIZE = 25;

/**
 * One row of the admin users table. Only these fields ever leave the server:
 * no password hash, token, or auth metadata.
 */
export type AdminUserRow = {
  id: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type AdminUserDetail = AdminUserRow & {
  phone: string | null;
  /** A doctors directory row exists; the role is then managed from Doctors. */
  hasDoctorRecord: boolean;
};

export type UserListFilters = {
  search: string;
  role: UserRole | null;
  status: UserStatusFilter | null;
  page: number;
};

/** One audit_logs row shown in a user's activity list. */
export type UserActivityEntry = {
  id: string;
  action: string;
  actorProfileId: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
};
