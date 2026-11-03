import { z } from "zod";

/** Digits, spaces, and + ( ) - only, at least seven characters. */
export const PHONE_PATTERN = /^[+\d][\d\s().-]{6,}$/;
export const PHONE_MAX_LENGTH = 32;
export const PHONE_INVALID_MESSAGE =
  "Enter a valid phone number (digits, spaces, and + ( ) - only).";

/**
 * Permitted doctor self-service fields. Name, role, department, and specialty
 * are hospital-managed and not editable here.
 */
export const updateDoctorProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX_LENGTH, "Keep the phone number under 32 characters.")
    .refine((value) => value === "" || PHONE_PATTERN.test(value), PHONE_INVALID_MESSAGE),
  clinicNote: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters."),
});

export type UpdateDoctorProfileInput = z.infer<
  typeof updateDoctorProfileSchema
>;
