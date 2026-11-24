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
const optionalPhone = z
  .string()
  .trim()
  .max(PHONE_MAX_LENGTH, "Keep the phone number under 32 characters.")
  .refine((value) => value === "" || PHONE_PATTERN.test(value), PHONE_INVALID_MESSAGE);

export const updateDoctorProfileSchema = z.object({
  phone: optionalPhone,
  clinicNote: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters."),
});

export type UpdateDoctorProfileInput = z.infer<
  typeof updateDoctorProfileSchema
>;

/** Patient self-service fields. Role, status, and email are never editable here. */
export const updatePatientProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(100, "Keep the name under 100 characters."),
  phone: optionalPhone,
});

export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;
