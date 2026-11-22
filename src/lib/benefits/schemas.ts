import { z } from "zod";

import { ACCREDITATION_STATUSES, AUTHORIZATION_STATUSES, COVERAGE_STATUSES } from "./types";

/** BEN-03: validated input for the benefits actions (client input is never trusted). */

const idSchema = (message: string) => z.uuid(message);

const trimmedText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

/** Missing, blank, or whitespace-only input all mean "no value". */
const optionalTrimmedText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .transform((value) => (value ? value : null));

const dateText = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date (YYYY-MM-DD).`);

export const pwdSubmissionSchema = z.object({
  idNumber: trimmedText(50, "PWD ID number"),
});

export const hmoSubmissionSchema = z.object({
  providerId: idSchema("Choose an HMO provider."),
  membershipNumber: trimmedText(50, "Membership number"),
});

export const benefitDecisionSchema = z
  .object({
    decision: z.enum(["verify", "reject"], "Choose verify or reject."),
    reason: optionalTrimmedText(500, "Reason"),
  })
  .refine((value) => value.decision !== "reject" || value.reason !== null, {
    path: ["reason"],
    message: "A reason is required to reject.",
  })
  .transform((value) => ({ decision: value.decision, reason: value.reason }));

export const accreditationSaveSchema = z
  .object({
    doctorId: idSchema("Invalid doctor."),
    providerId: idSchema("Choose an HMO provider."),
    status: z.enum(ACCREDITATION_STATUSES, "Choose a valid status."),
    validFrom: dateText("Valid from"),
    validUntil: z
      .string()
      .transform((value) => (value === "" ? null : value))
      .pipe(z.union([z.null(), dateText("Valid until")])),
  })
  .refine((value) => value.validUntil === null || value.validUntil >= value.validFrom, {
    path: ["validUntil"],
    message: "Valid until cannot be before valid from.",
  });

export const appointmentHmoUpdateSchema = z.object({
  authorization: z.enum(AUTHORIZATION_STATUSES, "Choose an authorization status."),
  coverage: z.enum(COVERAGE_STATUSES, "Choose a coverage status."),
  loaNumber: optionalTrimmedText(100, "LOA number"),
  remarks: optionalTrimmedText(500, "Remarks"),
});
