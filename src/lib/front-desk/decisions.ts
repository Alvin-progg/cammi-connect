import { z } from "zod";

import type { AvailabilityRejection } from "@/lib/schedules/availability";

/** Rejection reasons offered to staff (SPEC-frontdesk §6, Reject Appointment). */
export const REJECTION_REASONS = [
  "schedule_unavailable",
  "incomplete_information",
  "invalid_request",
  "doctor_unavailable",
  "other",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  schedule_unavailable: "Requested schedule is no longer available",
  incomplete_information: "Incomplete appointment information",
  invalid_request: "Invalid or unsupported appointment request",
  doctor_unavailable: "Doctor unavailable",
  other: "Other hospital-approved reason",
};

const DETAILS_MAX_LENGTH = 500;

const appointmentIdSchema = z.uuid("Invalid appointment reference.");

export const confirmRequestSchema = z.object({ appointmentId: appointmentIdSchema });

/**
 * Validates a rejection form and produces the text stored in
 * `appointments.rejection_reason`: the preset label, followed by the staff
 * member's details when given. "Other" must be explained.
 */
export const rejectRequestSchema = z
  .object({
    appointmentId: appointmentIdSchema,
    reason: z.enum(REJECTION_REASONS, "Choose a reason for rejecting."),
    details: z
      .string()
      .trim()
      .max(DETAILS_MAX_LENGTH, `Keep the details under ${DETAILS_MAX_LENGTH} characters.`)
      .nullish(),
  })
  .refine((input) => input.reason !== "other" || Boolean(input.details), {
    message: "Describe the reason for rejecting this request.",
    path: ["details"],
  })
  .transform(({ appointmentId, reason, details }) => ({
    appointmentId,
    rejectionReason: details
      ? `${REJECTION_REASON_LABELS[reason]}: ${details}`
      : REJECTION_REASON_LABELS[reason],
  }));

/**
 * Result of re-checking a pending request against the doctor's current
 * schedule before staff decide. The database re-checks again on confirm.
 */
export type SlotCheck = "available" | AvailabilityRejection;

export const SLOT_CHECK_LABELS: Record<SlotCheck, string> = {
  available: "Still available",
  past: "The requested time has passed",
  outside_hours: "Outside the doctor's current hours",
  blocked: "Blocked by a schedule exception",
  overlap: "Overlaps another appointment",
};
