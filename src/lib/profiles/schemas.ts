import { z } from "zod";

/**
 * Permitted doctor self-service fields. Name, role, department, and specialty
 * are hospital-managed and not editable here.
 */
export const updateDoctorProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(32, "Keep the phone number under 32 characters.")
    .refine(
      (value) => value === "" || /^[+\d][\d\s().-]{6,}$/.test(value),
      "Enter a valid phone number (digits, spaces, and + ( ) - only).",
    ),
  clinicNote: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters."),
});

export type UpdateDoctorProfileInput = z.infer<
  typeof updateDoctorProfileSchema
>;
