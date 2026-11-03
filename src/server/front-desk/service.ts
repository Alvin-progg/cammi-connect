import "server-only";

import { z } from "zod";

import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import type { AppointmentStatus } from "@/lib/appointments/status";
import {
  PATIENT_SEARCH_LIMIT,
  normalizePhone,
  patientSearchSchema,
  type PatientMatch,
} from "@/lib/front-desk/booking";
import type { SlotCheck } from "@/lib/front-desk/decisions";
import {
  APPOINTMENT_SEARCH_LIMIT,
  OVERVIEW_LIST_LIMIT,
  type AppointmentSearchItem,
  type OverviewCounts,
  type RecentAppointment,
} from "@/lib/front-desk/overview";
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
import { generateAvailableSlots } from "@/lib/schedules/slots";
import type {
  DoctorAppointmentsReader,
  DoctorAvailabilityReader,
} from "@/server/appointments/service";
import {
  getAvailableSlots,
  type AvailabilitySource,
} from "@/server/availability/service";

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
  /** cammi_connect_reschedule_appointment (migration 0011). */
  reschedule(input: {
    appointmentId: string;
    staffId: string;
    scheduledAt: string;
    reason: string;
  }): Promise<WriteOutcome>;
  /** cammi_connect_cancel_appointment (migration 0011). */
  cancel(input: {
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
const EXCLUSION_VIOLATION = "23P01";

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

const GENERIC_APPOINTMENT_ERROR =
  "The appointment could not be updated. Try again in a moment.";

/** Staff-facing text for the coded refusals raised by the 0011 reschedule function. */
const RESCHEDULE_REFUSAL_MESSAGES: Record<string, string> = {
  reason_required: "A reason is required to reschedule.",
  not_found: "This appointment no longer exists.",
  not_reschedulable:
    "Only pending or confirmed appointments can be rescheduled. Refresh to see its current status.",
  unchanged: "Choose a time different from the current one.",
  inactive_doctor: "This doctor is no longer accepting appointments.",
  past: "Choose a future time.",
  outside_hours: "That time is not one of the doctor's consultation slots.",
  blocked: "The doctor is unavailable at that time.",
  // appointments_no_active_overlap: another appointment holds the new slot.
  [EXCLUSION_VIOLATION]: "That slot was just taken. Choose another time.",
};

/** Staff-facing text for the coded refusals raised by the 0011 cancel function. */
const CANCEL_REFUSAL_MESSAGES: Record<string, string> = {
  reason_required: "A reason is required to cancel.",
  not_found: "This appointment no longer exists.",
  not_cancellable:
    "Only pending or confirmed appointments can be cancelled. Refresh to see its current status.",
};

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
  return {
    ok: false,
    message: refusalMessage(outcome.error, refusalMessages) ?? genericMessage,
  };
}

/** The staff-facing text for a coded refusal or a taken slot, if any. */
function refusalMessage(
  error: { code: string; message: string },
  refusalMessages: Record<string, string>,
): string | undefined {
  if (error.code === RAISED_EXCEPTION) {
    return refusalMessages[error.message];
  }
  if (error.code === EXCLUSION_VIOLATION) {
    return refusalMessages[EXCLUSION_VIOLATION];
  }
  return undefined;
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
    GENERIC_APPOINTMENT_ERROR,
  );
}

/**
 * Moves a pending or confirmed appointment to another slot with the same
 * doctor. The database function locks the row, re-checks the slot, and writes
 * the audit entry with the previous and new times in one transaction; the
 * overlap constraint rejects a slot that was taken meanwhile
 * (SPEC-frontdesk §9). The staff ID comes from the session.
 */
export async function rescheduleAppointment(
  input: {
    appointmentId: string;
    staffId: string;
    scheduledAt: string;
    rescheduleReason: string;
  },
  writer: FrontDeskRequestsWriter,
): Promise<DecisionResult> {
  const reason = input.rescheduleReason.trim();
  if (!reason) {
    return { ok: false, message: RESCHEDULE_REFUSAL_MESSAGES.reason_required };
  }
  return toDecisionResult(
    await writer.reschedule({
      appointmentId: input.appointmentId,
      staffId: input.staffId,
      scheduledAt: input.scheduledAt,
      reason,
    }),
    RESCHEDULE_REFUSAL_MESSAGES,
    GENERIC_APPOINTMENT_ERROR,
  );
}

/** Cancels a pending or confirmed appointment with a reason; the row is kept. */
export async function cancelAppointment(
  input: { appointmentId: string; staffId: string; cancellationReason: string },
  writer: FrontDeskRequestsWriter,
): Promise<DecisionResult> {
  const reason = input.cancellationReason.trim();
  if (!reason) {
    return { ok: false, message: CANCEL_REFUSAL_MESSAGES.reason_required };
  }
  return toDecisionResult(
    await writer.cancel({
      appointmentId: input.appointmentId,
      staffId: input.staffId,
      reason,
    }),
    CANCEL_REFUSAL_MESSAGES,
    GENERIC_APPOINTMENT_ERROR,
  );
}

export type RescheduleSlotsSource = DoctorAvailabilityReader &
  Pick<DoctorAppointmentsReader, "listActiveIntervals">;

/**
 * The doctor's free slots on one Manila date, for moving an appointment
 * (SPEC-frontdesk §9 step 2). The appointment's own interval is left out of
 * the overlap check, so the slots around it stay available, and its current
 * time is not offered. The database function re-checks the chosen slot.
 */
export async function listRescheduleSlots(
  appointment: {
    appointmentId: string;
    doctorId: string;
    currentScheduledAt: string;
    date: string;
  },
  source: RescheduleSlotsSource,
  now: Date = new Date(),
): Promise<{ start: string; end: string }[]> {
  const day = manilaDayRange(appointment.date);
  const range = { start: day.start.toISOString(), end: day.end.toISOString() };
  const [schedules, exceptions, existing] = await Promise.all([
    source.listSchedulesForDoctor(appointment.doctorId),
    source.listExceptionsForDoctor({ doctorId: appointment.doctorId, ...range }),
    source.listActiveIntervals({
      doctorId: appointment.doctorId,
      ...range,
      excludeId: appointment.appointmentId,
    }),
  ]);

  const currentStart = new Date(appointment.currentScheduledAt).getTime();
  return generateAvailableSlots({
    doctorId: appointment.doctorId,
    schedules,
    exceptions: exceptions.map((exception) => ({
      start: new Date(exception.startsAt),
      end: new Date(exception.endsAt),
    })),
    existing: existing.map((interval) => ({
      start: new Date(interval.start),
      end: new Date(interval.end),
    })),
    fromDate: appointment.date,
    days: 1,
    now,
  })
    .filter((slot) => slot.start.getTime() !== currentStart)
    .map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() }));
}

// ---------------------------------------------------------------------------
// Staff-assisted booking (SPEC-frontdesk §7)
// ---------------------------------------------------------------------------

/** Patient lookup and walk-in registration. Only role = patient profiles. */
export type FrontDeskPatientsStore = {
  /** Name contains `name`, or phone contains `phone` when given. */
  searchPatients(input: {
    name: string;
    phone: string | null;
    limit: number;
  }): Promise<PatientMatch[]>;
  getPatient(patientId: string): Promise<PatientMatch | null>;
  findPatientsByPhone(phone: string): Promise<PatientMatch[]>;
  /** Inserts a patient profile with no login (auth_user_id null). */
  insertPatient(input: { fullName: string; phone: string }): Promise<{ id: string }>;
};

/** cammi_connect_front_desk_book_appointment (migration 0012). */
export type FrontDeskBooker = {
  bookForPatient(input: {
    patientId: string;
    doctorId: string;
    specialtyId: string | null;
    scheduledAt: string;
    reason: string | null;
    staffId: string;
  }): Promise<
    | { ok: true; appointmentId: string }
    | { ok: false; error: { code: string; message: string } }
  >;
};

/**
 * Validates a patient name-or-phone search. Phones are stored normalized, so
 * a query with digits also matches the number however it was typed.
 */
function parsePatientQuery(
  query: string,
): { ok: true; name: string; phone: string | null } | { ok: false; message: string } {
  const parsed = patientSearchSchema.safeParse({ q: query });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the search." };
  }
  const name = parsed.data.q;
  return { ok: true, name, phone: /\d/.test(name) ? normalizePhone(name) : null };
}

export async function searchPatients(
  query: string,
  store: FrontDeskPatientsStore,
): Promise<{ ok: true; patients: PatientMatch[] } | { ok: false; message: string }> {
  const parsed = parsePatientQuery(query);
  if (!parsed.ok) {
    return parsed;
  }
  const patients = await store.searchPatients({
    name: parsed.name,
    phone: parsed.phone,
    limit: PATIENT_SEARCH_LIMIT,
  });
  return { ok: true, patients };
}

const DUPLICATE_PHONE_MESSAGE =
  "A patient with this phone number is already registered. Search for them instead.";

/**
 * Registers a walk-in or phone-in patient as a record with no login
 * (decision 2026-11-03). A number already on file is refused so staff pick
 * the existing record instead of creating a duplicate.
 */
export async function registerPatient(
  input: { fullName: string; phone: string },
  store: FrontDeskPatientsStore,
): Promise<{ ok: true; patientId: string } | { ok: false; message: string }> {
  const phone = normalizePhone(input.phone);
  const existing = await store.findPatientsByPhone(phone);
  if (existing.length > 0) {
    return { ok: false, message: DUPLICATE_PHONE_MESSAGE };
  }
  const { id } = await store.insertPatient({ fullName: input.fullName, phone });
  return { ok: true, patientId: id };
}

/** Staff-facing text for the coded refusals raised by the 0012 function. */
const BOOKING_REFUSAL_MESSAGES: Record<string, string> = {
  invalid_patient: "This patient record can't be booked. Search for the patient again.",
  inactive_doctor: "This doctor is no longer accepting appointments.",
  specialty_mismatch: "This doctor doesn't offer the chosen specialty.",
  past: "Choose a future time.",
  outside_hours: "That time is not one of the doctor's consultation slots.",
  blocked: "The doctor is unavailable at that time.",
  // appointments_no_active_overlap: another appointment holds the slot.
  [EXCLUSION_VIOLATION]: "That slot was just taken. Choose another time.",
};

const GENERIC_BOOKING_ERROR = "The appointment could not be booked. Try again in a moment.";

/**
 * Books a confirmed appointment for a patient (SPEC-frontdesk §7). The
 * patient owns it; the staff member, from the session, is recorded as its
 * creator and confirmer. The database function re-checks the patient, the
 * doctor, and the slot, and writes the audit entry in the same transaction.
 */
export async function bookForPatient(
  input: {
    patientId: string;
    doctorId: string;
    specialtyId: string | null;
    scheduledAt: string;
    reason: string | null;
    staffId: string;
  },
  booker: FrontDeskBooker,
): Promise<{ ok: true; appointmentId: string } | { ok: false; message: string }> {
  const outcome = await booker.bookForPatient({
    patientId: input.patientId,
    doctorId: input.doctorId,
    specialtyId: input.specialtyId,
    scheduledAt: input.scheduledAt,
    reason: input.reason,
    staffId: input.staffId,
  });
  if (outcome.ok) {
    return outcome;
  }
  return {
    ok: false,
    message: refusalMessage(outcome.error, BOOKING_REFUSAL_MESSAGES) ?? GENERIC_BOOKING_ERROR,
  };
}

/**
 * The doctor's free slots on one Manila date (SPEC-frontdesk §7 steps 5–6),
 * from the same authoritative source the chatbot uses. Empty when the doctor
 * is inactive or lacks the chosen specialty.
 */
export async function listBookingSlots(
  query: { doctorId: string; specialtyId: string | null; date: string },
  source: AvailabilitySource,
  now: Date = new Date(),
): Promise<{ start: string; end: string }[]> {
  const [availability] = await getAvailableSlots(
    {
      doctorId: query.doctorId,
      specialtyId: query.specialtyId ?? undefined,
      fromDate: query.date,
      days: 1,
      now,
    },
    source,
  );
  return availability?.slots ?? [];
}

// ---------------------------------------------------------------------------
// Dashboard overview (SPEC-frontdesk §4)
// ---------------------------------------------------------------------------

/** ISO bounds of a Manila day. */
export type IsoRange = { start: string; end: string };

/** Read model for the overview. Callers must have checked the front desk session first. */
export type FrontDeskOverviewReader = {
  /** Appointments still `requested`, on any date. */
  countPending(): Promise<number>;
  /** Appointments whose `confirmed_at` falls in the range. */
  countConfirmedBetween(range: IsoRange): Promise<number>;
  /**
   * Appointments now in `status` whose `updated_at` falls in the range. Both
   * statuses are terminal, so `updated_at` is when the status was set.
   */
  countStatusChangedBetween(
    status: "completed" | "cancelled",
    range: IsoRange,
  ): Promise<number>;
  /** Latest by `confirmed_at`, whatever the current status. */
  listRecentConfirmed(limit: number): Promise<RecentAppointment[]>;
  /** Latest `rejected` or `cancelled` by `updated_at`. */
  listRecentClosed(limit: number): Promise<RecentAppointment[]>;
  /** Appointments of patients whose name contains `name` or phone contains `phone`. */
  searchAppointments(input: {
    name: string;
    phone: string | null;
    limit: number;
  }): Promise<AppointmentSearchItem[]>;
};

/**
 * The four summary cards. "Today" is the Asia/Manila calendar day containing
 * `now`, so an action at 00:30 Manila time counts on the new Manila day even
 * though it is still the previous day in UTC.
 */
export async function getOverviewCounts(
  reader: FrontDeskOverviewReader,
  now: Date = new Date(),
): Promise<OverviewCounts> {
  const day = manilaDayRange(todayInManila(now));
  const today = { start: day.start.toISOString(), end: day.end.toISOString() };
  const [pending, confirmedToday, completedToday, cancelledToday] = await Promise.all([
    reader.countPending(),
    reader.countConfirmedBetween(today),
    reader.countStatusChangedBetween("completed", today),
    reader.countStatusChangedBetween("cancelled", today),
  ]);
  return { pending, confirmedToday, completedToday, cancelledToday };
}

export async function getRecentActivity(
  reader: FrontDeskOverviewReader,
): Promise<{ recentConfirmed: RecentAppointment[]; recentClosed: RecentAppointment[] }> {
  const [recentConfirmed, recentClosed] = await Promise.all([
    reader.listRecentConfirmed(OVERVIEW_LIST_LIMIT),
    reader.listRecentClosed(OVERVIEW_LIST_LIMIT),
  ]);
  return { recentConfirmed, recentClosed };
}

/** The soonest pending Cami requests on any date, shown first on the overview. */
export async function listPendingPreview(
  reader: FrontDeskRequestsReader,
): Promise<RequestQueueItem[]> {
  return reader.listRequests({
    status: "requested",
    start: null,
    end: null,
    doctorId: null,
    specialtyId: null,
    limit: OVERVIEW_LIST_LIMIT,
  });
}

/** Quick appointment search by patient name or phone. */
export async function searchAppointments(
  query: string,
  reader: FrontDeskOverviewReader,
): Promise<{ ok: true; items: AppointmentSearchItem[] } | { ok: false; message: string }> {
  const parsed = parsePatientQuery(query);
  if (!parsed.ok) {
    return parsed;
  }
  const items = await reader.searchAppointments({
    name: parsed.name,
    phone: parsed.phone,
    limit: APPOINTMENT_SEARCH_LIMIT,
  });
  return { ok: true, items };
}
