import { z } from "zod";

/** Trims a form value and treats a blank one as "not provided". */
const trimmedOrNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

function optionalText(max: number, message: string) {
  return z.preprocess(trimmedOrNull, z.string().max(max, message).nullable().default(null));
}

/**
 * The admin doctor form. Activation is a separate audited action (it can be
 * refused), so it is not part of this form. `accountProfileId` is only read on
 * create; an existing doctor is linked through its own action.
 */
export const doctorFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the doctor's full name.")
    .max(120, "Keep the name under 120 characters."),
  departmentId: z.uuid("Choose a department."),
  specialtyIds: z
    .array(z.uuid("Choose a valid specialty."))
    .min(1, "Choose at least one specialty.")
    .transform((ids) => [...new Set(ids)]),
  contactEmail: z.preprocess(
    trimmedOrNull,
    z
      .email("Enter a valid email address.")
      .max(254, "Keep the email under 254 characters.")
      .nullable()
      .default(null),
  ),
  contactPhone: optionalText(40, "Keep the phone number under 40 characters."),
  bio: optionalText(1000, "Keep the bio under 1000 characters."),
  accountProfileId: z.preprocess(
    trimmedOrNull,
    z.uuid("Choose a valid account.").nullable().default(null),
  ),
});

export type DoctorFormInput = z.infer<typeof doctorFormSchema>;
