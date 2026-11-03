import { z } from "zod";

import type { AppointmentStatus } from "@/lib/appointments/status";
import { canTransition } from "@/lib/appointments/transitions";
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

/** Cancellation reasons offered to staff (SPEC-frontdesk §9, Cancellation). */
export const CANCELLATION_REASONS = [
  "patient_request",
  "doctor_unavailable",
  "schedule_change",
  "duplicate",
  "other",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  patient_request: "Patient request",
  doctor_unavailable: "Doctor unavailable",
  schedule_change: "Hospital schedule change",
  duplicate: "Duplicate appointment",
  other: "Other hospital-approved reason",
};

/** Reschedule reasons offered to staff (SPEC-frontdesk §9, Rescheduling). */
export const RESCHEDULE_REASONS = [
  "patient_request",
  "doctor_unavailable",
  "schedule_change",
  "other",
] as const;

export type RescheduleReason = (typeof RESCHEDULE_REASONS)[number];

export const RESCHEDULE_REASON_LABELS: Record<RescheduleReason, string> = {
  patient_request: "Patient request",
  doctor_unavailable: "Doctor unavailable",
  schedule_change: "Hospital schedule change",
  other: "Other hospital-approved reason",
};

const DETAILS_MAX_LENGTH = 500;

const appointmentIdSchema = z.uuid("Invalid appointment reference.");

export const confirmRequestSchema = z.object({ appointmentId: appointmentIdSchema });

/**
 * A preset reason plus optional staff details, stored as one text: the
 * preset label, followed by the details when given. "Other" must be
 * explained. Shared by reject, cancel, and reschedule.
 */
function presetReasonFields<const Reason extends string>(
  reasons: readonly [Reason, ...Reason[]],
  messages: { missing: string; otherNeedsDetails: string },
) {
  return {
    schema: z.object({
      reason: z.enum(reasons, messages.missing),
      details: z
        .string()
        .trim()
        .max(DETAILS_MAX_LENGTH, `Keep the details under ${DETAILS_MAX_LENGTH} characters.`)
        .nullish(),
    }),
    otherNeedsDetails: {
      check: (input: { reason: string; details?: string | null }) =>
        input.reason !== "other" || Boolean(input.details),
      message: messages.otherNeedsDetails,
    },
  };
}

function storedReason<Reason extends string>(
  labels: Record<Reason, string>,
  reason: Reason,
  details: string | null | undefined,
): string {
  return details ? `${labels[reason]}: ${details}` : labels[reason];
}

const rejectionFields = presetReasonFields(REJECTION_REASONS, {
  missing: "Choose a reason for rejecting.",
  otherNeedsDetails: "Describe the reason for rejecting this request.",
});

/**
 * Validates a rejection form and produces the text stored in
 * `appointments.rejection_reason`.
 */
export const rejectRequestSchema = rejectionFields.schema
  .extend({ appointmentId: appointmentIdSchema })
  .refine(rejectionFields.otherNeedsDetails.check, {
    message: rejectionFields.otherNeedsDetails.message,
    path: ["details"],
  })
  .transform(({ appointmentId, reason, details }) => ({
    appointmentId,
    rejectionReason: storedReason(REJECTION_REASON_LABELS, reason, details),
  }));

const cancellationFields = presetReasonFields(CANCELLATION_REASONS, {
  missing: "Choose a reason for cancelling.",
  otherNeedsDetails: "Describe the reason for cancelling this appointment.",
});

/** Validates a cancellation form; the text goes to `cancellation_reason`. */
export const cancelAppointmentSchema = cancellationFields.schema
  .extend({ appointmentId: appointmentIdSchema })
  .refine(cancellationFields.otherNeedsDetails.check, {
    message: cancellationFields.otherNeedsDetails.message,
    path: ["details"],
  })
  .transform(({ appointmentId, reason, details }) => ({
    appointmentId,
    cancellationReason: storedReason(CANCELLATION_REASON_LABELS, reason, details),
  }));

const rescheduleFields = presetReasonFields(RESCHEDULE_REASONS, {
  missing: "Choose a reason for rescheduling.",
  otherNeedsDetails: "Describe the reason for rescheduling this appointment.",
});

/**
 * Validates a reschedule form. The new time is one of the slots offered from
 * the doctor's availability; the database function re-checks it.
 */
export const rescheduleAppointmentSchema = rescheduleFields.schema
  .extend({
    appointmentId: appointmentIdSchema,
    scheduledAt: z.iso.datetime({ offset: true, error: "Choose a new time." }),
  })
  .refine(rescheduleFields.otherNeedsDetails.check, {
    message: rescheduleFields.otherNeedsDetails.message,
    path: ["details"],
  })
  .transform(({ appointmentId, scheduledAt, reason, details }) => ({
    appointmentId,
    scheduledAt,
    rescheduleReason: storedReason(RESCHEDULE_REASON_LABELS, reason, details),
  }));

/**
 * Front desk may cancel or reschedule a pending or confirmed appointment
 * (SPEC-frontdesk §9, §11). A reschedule keeps the status. The 0011 database
 * functions enforce the same rule.
 */
export function canFrontDeskCancel(status: AppointmentStatus): boolean {
  return canTransition(status, "cancelled");
}

export function canFrontDeskReschedule(status: AppointmentStatus): boolean {
  return status === "requested" || status === "confirmed";
}

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
