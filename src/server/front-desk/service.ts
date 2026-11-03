import "server-only";

import { z } from "zod";

import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import type { AppointmentStatus } from "@/lib/appointments/status";
import type { SlotCheck } from "@/lib/front-desk/decisions";
import {
  REQUEST_QUEUE_LIMIT,
  type RequestDetails,
  type RequestQueueFilters,
  type RequestQueueItem,
} from "@/lib/front-desk/requests";
import { validateAppointmentSlot } from "@/lib/schedules/availability";
import type { DoctorAvailabilityReader } from "@/server/appointments/service";

export const QUEUE_LIMIT = REQUEST_QUEUE_LIMIT;

export type RequestQueueQuery = {
  status: AppointmentStatus | null;
  /** ISO bounds of the requested appointment time, or null for any day. */
  start: string | null;
  end: string | null;
  doctorId: string | null;
  specialtyId: string | null;
  limit: number;
};

/**
 * Reads appointment requests submitted through Cami (`booking_source =
 * ai_chatbot`). Callers must have checked the front desk session first.
 */
export type FrontDeskRequestsReader = {
  listRequests(query: RequestQueueQuery): Promise<RequestQueueItem[]>;
  getRequest(appointmentId: string): Promise<RequestDetails | null>;
};

export async function listRequestQueue(
  filters: RequestQueueFilters,
  reader: FrontDeskRequestsReader,
): Promise<{ items: RequestQueueItem[]; limitReached: boolean }> {
  const range = filters.date ? manilaDayRange(filters.date) : null;
  const status: AppointmentStatus | null =
    filters.status === "all"
      ? null
      : filters.status === "pending"
        ? "requested"
        : filters.status;

  const items = await reader.listRequests({
    status,
    start: range ? range.start.toISOString() : null,
    end: range ? range.end.toISOString() : null,
    doctorId: filters.doctorId,
    specialtyId: filters.specialtyId,
    limit: QUEUE_LIMIT,
  });

  return { items, limitReached: items.length >= QUEUE_LIMIT };
}

export async function getRequestDetails(
  appointmentId: string,
  reader: FrontDeskRequestsReader,
): Promise<RequestDetails | null> {
  if (!z.uuid().safeParse(appointmentId).success) {
    return null;
  }
  return reader.getRequest(appointmentId);
}

/**
 * Atomic confirm and reject, implemented by the
 * cammi_connect_confirm_appointment and cammi_connect_reject_appointment
 * database functions (migration 0009). A failure carries the raw database
 * error so the service can translate it without leaking internals.
 */
export type FrontDeskRequestsWriter = {
  confirm(input: { appointmentId: string; staffId: string }): Promise<WriteOutcome>;
  reject(input: {
    appointmentId: string;
    staffId: string;
    reason: string;
  }): Promise<WriteOutcome>;
};

type WriteOutcome =
  | { ok: true }
  | { ok: false; error: { code: string; message: string } };

export type DecisionResult = { ok: true } | { ok: false; message: string };

const RAISED_EXCEPTION = "P0001";

/** Staff-facing text for the coded refusals raised by the 0009 functions. */
const DECISION_REFUSAL_MESSAGES: Record<string, string> = {
  not_pending: "This request is no longer pending. Refresh to see its current status.",
  not_found: "This appointment request no longer exists.",
  past: "The requested time has already passed. Reject the request instead.",
  outside_hours:
    "The requested time is no longer within the doctor's consultation hours.",
  blocked: "The doctor is unavailable at the requested time.",
  inactive_doctor: "This doctor is no longer accepting appointments.",
  reason_required: "A rejection reason is required.",
};

const GENERIC_DECISION_ERROR =
  "The request could not be updated. Try again in a moment.";

function toDecisionResult(outcome: WriteOutcome): DecisionResult {
  if (outcome.ok) {
    return { ok: true };
  }
  const message =
    outcome.error.code === RAISED_EXCEPTION
      ? DECISION_REFUSAL_MESSAGES[outcome.error.message]
      : undefined;
  return { ok: false, message: message ?? GENERIC_DECISION_ERROR };
}

/**
 * Confirms a pending request. The database function locks the row, re-checks
 * the doctor's availability, and records the staff member, the timestamp,
 * and the audit entry in one transaction, so success is only reported after
 * it commits (SPEC-frontdesk §6). The staff ID comes from the session.
 */
export async function confirmRequest(
  input: { appointmentId: string; staffId: string },
  writer: FrontDeskRequestsWriter,
): Promise<DecisionResult> {
  return toDecisionResult(await writer.confirm(input));
}

/** Rejects a pending request with a reason; the row is kept, never deleted. */
export async function rejectRequest(
  input: { appointmentId: string; staffId: string; rejectionReason: string },
  writer: FrontDeskRequestsWriter,
): Promise<DecisionResult> {
  const reason = input.rejectionReason.trim();
  if (!reason) {
    return { ok: false, message: DECISION_REFUSAL_MESSAGES.reason_required };
  }
  return toDecisionResult(
    await writer.reject({
      appointmentId: input.appointmentId,
      staffId: input.staffId,
      reason,
    }),
  );
}

/**
 * Re-checks a pending request against the doctor's current hours and
 * exceptions so staff can verify availability before deciding (§14). Other
 * appointments are not checked: a pending request already holds its slot
 * under the appointments_no_active_overlap constraint.
 */
export async function checkRequestSlot(
  request: { doctorId: string; scheduledAt: string; durationMinutes: number },
  availability: DoctorAvailabilityReader,
  now: Date = new Date(),
): Promise<SlotCheck> {
  const start = new Date(request.scheduledAt);
  const day = manilaDayRange(todayInManila(start));
  const [schedules, exceptions] = await Promise.all([
    availability.listSchedulesForDoctor(request.doctorId),
    availability.listExceptionsForDoctor({
      doctorId: request.doctorId,
      start: day.start.toISOString(),
      end: day.end.toISOString(),
    }),
  ]);

  const validation = validateAppointmentSlot({
    start,
    durationMinutes: request.durationMinutes,
    now,
    schedules,
    blocks: exceptions.map((exception) => ({
      start: new Date(exception.startsAt),
      end: new Date(exception.endsAt),
    })),
    existing: [],
  });
  return validation.ok ? "available" : validation.reason;
}
