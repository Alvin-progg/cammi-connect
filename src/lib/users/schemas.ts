import { z } from "zod";

import { USER_ROLES } from "@/lib/auth/roles";
import { normalizePhone } from "@/lib/front-desk/booking";

import {
  STAFF_ROLES,
  USER_STATUS_FILTERS,
  type UserListFilters,
} from "./types";

const PHONE_MAX_LENGTH = 32;
const REASON_MAX_LENGTH = 500;

const fullName = z
  .string()
  .trim()
  .min(2, "Enter the full name.")
  .max(100, "Full name is too long.");

/** Optional phone, stored in the same canonical form as walk-in patients. */
const phone = z
  .string()
  .nullish()
  .transform((value) => (value?.trim() ? normalizePhone(value) : null))
  .pipe(
    z
      .string()
      .max(PHONE_MAX_LENGTH, "Keep the phone number under 32 characters.")
      .nullable(),
  );

const reason = z
  .string()
  .trim()
  .min(1, "Enter a reason for this change.")
  .max(REASON_MAX_LENGTH, "Keep the reason under 500 characters.");

const profileId = z.uuid("That account is not valid.");

export const staffInviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  fullName,
  role: z.enum(STAFF_ROLES, "Choose a staff role."),
  phone,
});

export const roleChangeSchema = z.object({
  profileId,
  role: z.enum(USER_ROLES, "Choose a role."),
  reason,
});

export const activeChangeSchema = z.object({
  profileId,
  isActive: z.boolean(),
  reason,
});

export const profileUpdateSchema = z.object({
  profileId,
  fullName,
  phone,
});

export type StaffInviteInput = z.infer<typeof staffInviteSchema>;
export type RoleChangeInput = z.infer<typeof roleChangeSchema>;
export type ActiveChangeInput = z.infer<typeof activeChangeSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const SEARCH_MAX_LENGTH = 100;

/** Users table filters from search params; anything invalid falls back to its default. */
export function parseUserListFilters(params: {
  q?: SearchParamValue;
  role?: SearchParamValue;
  status?: SearchParamValue;
  page?: SearchParamValue;
}): UserListFilters {
  const role = z.enum(USER_ROLES).safeParse(firstValue(params.role));
  const status = z.enum(USER_STATUS_FILTERS).safeParse(firstValue(params.status));
  const page = z.coerce.number().int().min(1).safeParse(firstValue(params.page));

  return {
    search: (firstValue(params.q) ?? "").trim().slice(0, SEARCH_MAX_LENGTH),
    role: role.success ? role.data : null,
    status: status.success ? status.data : null,
    page: page.success ? page.data : 1,
  };
}
