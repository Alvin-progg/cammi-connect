import "server-only";

import { z } from "zod";

import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import type { AppointmentStatus } from "@/lib/appointments/status";
import type { SlotCheck } from "@/lib/front-desk/decisions";
import {
  SCHEDULE_LIMIT,
  type AttendanceStatus,
  type ScheduleFilters,
  type ScheduleItem,
} from "@/lib/front-desk/schedule";
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
  /** cammi_connect_record_attendance (migration 0010). */
  recordAttendance(input: {
    appointmentId: string;
    staffId: string;
    status: AttendanceStatus;
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

/** Staff-facing text for the coded refusals raised by the 0010 function. */
const ATTENDANCE_REFUSAL_MESSAGES: Record<string, string> = {
  invalid_transition:
    "This appointment's status changed and the update no longer applies. Refresh to see its current status.",
  not_yet: "Attendance can only be recorded on or after the appointment day.",
  invalid_status: "Choose check-in, completed, or no-show.",
  not_found: "This appointment no longer exists.",
};

const GENERIC_ATTENDANCE_ERROR =
  "The appointment could not be updated. Try again in a moment.";

/**
 * Translates a database outcome into staff-facing text. Only the coded
 * refusals the functions raise are shown; anything else is replaced by the
 * generic message so internals never reach the client.
 */
function toDecisionResult(
  outcome: WriteOutcome,
  refusalMessages: Record<string, string> = DECISION_REFUSAL_MESSAGES,
  genericMessage: string = GENERIC_DECISION_ERROR,
): DecisionResult {
  if (outcome.ok) {
    return { ok: true };
  }
  const message =
    outcome.error.code === RAISED_EXCEPTION
      ? refusalMessages[outcome.error.message]
      : undefined;
  return { ok: false, message: message ?? genericMessage };
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

export type ScheduleDayQuery = {
  /** ISO bounds of the Manila day. */
  start: string;
  end: string;
  doctorId: string | null;
  status: AppointmentStatus | null;
  limit: number;
};

/**
 * Reads every appointment on a day, whatever its booking source
 * (SPEC-frontdesk §8). Callers must have checked the front desk session first.
 */
export type FrontDeskScheduleReader = {
  listDay(query: ScheduleDayQuery): Promise<ScheduleItem[]>;
};

export async function listDailySchedule(
  filters: ScheduleFilters,
  reader: FrontDeskScheduleReader,
): Promise<{ items: ScheduleItem[]; limitReached: boolean }> {
  const range = manilaDayRange(filters.date);
  const dayItems = await reader.listDay({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    doctorId: filters.doctorId,
    status: filters.status === "all" ? null : filters.status,
    limit: SCHEDULE_LIMIT,
  });

  // The day is bounded by the limit, so the name search runs here rather than
  // as a cross-table query.
  const search = filters.search?.toLocaleLowerCase();
  const items = search
    ? dayItems.filter((item) => item.patientName.toLocaleLowerCase().includes(search))
    : dayItems;

  return { items, limitReached: dayItems.length >= SCHEDULE_LIMIT };
}

/**
 * Records check-in, completion, or no-show. The database function locks the
 * row, re-checks the transition and the appointment day, and writes the audit
 * entry with the staff member in one transaction (SPEC-frontdesk §8). The
 * staff ID comes from the session.
 */
export async function recordAttendance(
  input: { appointmentId: string; staffId: string; status: AttendanceStatus },
  writer: FrontDeskRequestsWriter,
): Promise<DecisionResult> {
  return toDecisionResult(
    await writer.recordAttendance(input),
    ATTENDANCE_REFUSAL_MESSAGES,
    GENERIC_ATTENDANCE_ERROR,
  );
}
