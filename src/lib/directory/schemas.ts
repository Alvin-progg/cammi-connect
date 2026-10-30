import { z } from "zod";

/** Form fields arrive as "" when left blank; treat that as "not provided". */
const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalDescription = z.preprocess(
  blankToNull,
  z
    .string()
    .trim()
    .max(500, "Keep the description under 500 characters.")
    .nullable()
    .default(null),
);

export const departmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a department name.")
    .max(100, "Keep the name under 100 characters."),
  code: z
    .string()
    .trim()
    .min(1, "Enter a short department code.")
    .max(10, "Keep the code to 10 characters or fewer.")
    .transform((code) => code.toUpperCase()),
  description: optionalDescription,
  isActive: z.boolean(),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;

export const specialtySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a specialty name.")
    .max(100, "Keep the name under 100 characters."),
  description: optionalDescription,
  isActive: z.boolean(),
});

export type SpecialtyInput = z.infer<typeof specialtySchema>;

export const doctorSchema = z.object({
  /** Existing profile to promote; null creates a doctor without a login. */
  profileId: z.preprocess(
    blankToNull,
    z.uuid("Choose a valid account.").nullable().default(null),
  ),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the doctor's full name.")
    .max(120, "Keep the name under 120 characters."),
  departmentId: z.preprocess(
    blankToNull,
    z.uuid("Choose a valid department.").nullable().default(null),
  ),
  specialtyIds: z
    .array(z.uuid("Choose a valid specialty."))
    .min(1, "Choose at least one specialty.")
    .transform((ids) => [...new Set(ids)]),
  isActive: z.boolean(),
});

export type DoctorInput = z.infer<typeof doctorSchema>;

export const directoryRecordIdSchema = z.uuid("Invalid record reference.");
