import "server-only";

import {
  canDoctorPerform,
  sourceStatusesForAction,
  targetStatusForAction,
  type DoctorAppointmentAction,
} from "@/lib/appointments/transitions";
import type { AppointmentStatus } from "@/lib/appointments/status";
import { summarizeAppointments } from "@/lib/appointments/stats";
import type {
  AppointmentHistoryEntry,
  DoctorAppointment,
} from "@/lib/appointments/types";
import {
  manilaDayRange,
  type AppointmentFilters,
} from "@/lib/appointments/filters";
import { validateAppointmentSlot } from "@/lib/schedules/availability";
import type { DoctorSchedulesStore } from "@/server/schedules/service";

export type ActiveInterval = { start: string; end: string };

/**
 * Data access contract for the doctor appointment slice. Every method is
 * scoped by the authenticated doctor's profile ID; the ID always comes from
 * the session, never from the URL.
 */
export type DoctorAppointmentsReader = {
  listForDoctor(input: {
    doctorId: string;
    start: string;
    end: string;
    status: AppointmentStatus | null;
  }): Promise<DoctorAppointment[]>;
  countForDoctor(input: {
    doctorId: string;
    start: string;
    end: string;
  }): Promise<number>;
  getForDoctor(input: {
    doctorId: string;
    appointmentId: string;
  }): Promise<DoctorAppointment | null>;
  /** Active (requested/confirmed) [start, end) intervals for overlap checks. */
  listActiveIntervals(input: {
    doctorId: string;
    start: string;
    end: string;
    excludeId?: string;
  }): Promise<ActiveInterval[]>;
  /**
   * Guarded status update: only applies when the current status is one of
   * `from`. Returns whether a row changed (false = concurrent transition).
   */
  applyTransition(input: {
    appointmentId: string;
    from: readonly AppointmentStatus[];
    to: AppointmentStatus;
    cancellationReason: string | null;
  }): Promise<boolean>;
  reschedule(input: {
    appointmentId: string;
    scheduledAt: string;
    rescheduledFromAt: string;
  }): Promise<boolean>;
  insertHistory(input: {
    appointmentId: string;
    fromStatus: AppointmentStatus | null;
    toStatus: AppointmentStatus;
    changedByProfileId: string;
    reason: string | null;
    scheduledAtSnapshot: string | null;
  }): Promise<void>;
  listHistory(input: {
    appointmentIds: string[];
  }): Promise<AppointmentHistoryEntry[]>;
};

/** Minimal schedule-read contract needed for reschedule validation. */
export type DoctorAvailabilityReader = Pick<
  DoctorSchedulesStore,
  "listSchedulesForDoctor" | "listExceptionsForDoctor"
>;

/**
 * Atomic booking contract, implemented by the cammi_connect_book_appointment
 * database function. A failure carries the raw database error so the service
 * can translate it without leaking internals.
 */
export type AppointmentBooker = {
  book(input: {
    doctorId: string;
    patientId: string;
    scheduledAt: string;
    reason: string | null;
  }): Promise<
    | { ok: true; appointmentId: string }
    | { ok: false; error: { code: string; message: string } }
  >;
};

export type MutationResult = { ok: true } | { ok: false; message: string };

/**
 * The doctor ID comes from the authenticated session profile, never from a
 * query parameter. The reader receives the Manila day boundaries so the
 * database query is bounded and timezone-correct.
 */
export async function listDoctorAppointments(
  input: { doctorId: string; filters: AppointmentFilters },
  reader: DoctorAppointmentsReader,
): Promise<DoctorAppointment[]> {
  const range = manilaDayRange(input.filters.date);

  return reader.listForDoctor({
    doctorId: input.doctorId,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    status: input.filters.status,
  });
}

export async function listDoctorAppointmentsInRange(
  input: {
    doctorId: string;
    start: Date;
    end: Date;
    status: AppointmentStatus | null;
  },
  reader: DoctorAppointmentsReader,
): Promise<DoctorAppointment[]> {
  return reader.listForDoctor({
    doctorId: input.doctorId,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    status: input.status,
  });
}

export async function countDoctorAppointments(
  input: { doctorId: string; start: Date; end: Date },
  reader: DoctorAppointmentsReader,
): Promise<number> {
  return reader.countForDoctor({
    doctorId: input.doctorId,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
  });
}

/**
 * Applies a doctor-initiated status transition. The transition matrix is
 * checked before the guarded write, and the write itself is guarded on the
 * current status so a concurrent change cannot be overwritten silently.
 */
export async function transitionDoctorAppointment(
  input: {
    doctorId: string;
    appointmentId: string;
    action: DoctorAppointmentAction;
    reason?: string;
  },
  reader: DoctorAppointmentsReader,
): Promise<MutationResult> {
  const appointment = await reader.getForDoctor({
    doctorId: input.doctorId,
    appointmentId: input.appointmentId,
  });
  if (!appointment) {
    return { ok: false, message: "Appointment not found." };
  }
  if (!canDoctorPerform(appointment.status, input.action)) {
    return {
      ok: false,
      message:
        "This action is no longer available for the appointment's current status. Refresh and try again.",
    };
  }

  const reason = input.reason?.trim() || null;
  if (input.action === "cancel" && !reason) {
    return { ok: false, message: "A reason is required to cancel." };
  }

  const to = targetStatusForAction(input.action);
  const changed = await reader.applyTransition({
    appointmentId: appointment.id,
    from: sourceStatusesForAction(input.action),
    to,
    cancellationReason: input.action === "cancel" ? reason : null,
  });
  if (!changed) {
    return {
      ok: false,
      message: "The appointment status just changed. Refresh and try again.",
    };
  }

  await reader.insertHistory({
    appointmentId: appointment.id,
    fromStatus: appointment.status,
    toStatus: to,
    changedByProfileId: input.doctorId,
    reason,
    scheduledAtSnapshot: appointment.scheduledAt,
  });
  return { ok: true };
}

const RESCHEDULE_REJECTION_MESSAGES = {
  past: "Choose a future date and time.",
  outside_hours:
    "That time is outside your regular consultation hours. Adjust your schedule first if needed.",
  blocked: "That time overlaps one of your schedule exceptions.",
  overlap: "That time overlaps another appointment.",
} as const;

/**
 * Reschedules a requested/confirmed appointment to a new time. The new slot
 * must be in the future, inside an active consultation period, outside
 * schedule exceptions, and free of overlaps with other active appointments.
 */
export async function rescheduleDoctorAppointment(
  input: {
    doctorId: string;
    appointmentId: string;
    newScheduledAt: Date;
    note?: string;
    now?: Date;
  },
  readers: {
    appointments: DoctorAppointmentsReader;
    availability: DoctorAvailabilityReader;
  },
): Promise<MutationResult> {
  const appointment = await readers.appointments.getForDoctor({
    doctorId: input.doctorId,
    appointmentId: input.appointmentId,
  });
  if (!appointment) {
    return { ok: false, message: "Appointment not found." };
  }
  if (appointment.status !== "requested" && appointment.status !== "confirmed") {
    return {
      ok: false,
      message: "Only requested or confirmed appointments can be rescheduled.",
    };
  }

  const day = manilaDayRange(manilaDateOf(input.newScheduledAt));
  const [schedules, blocks, existing] = await Promise.all([
    readers.availability.listSchedulesForDoctor(input.doctorId),
    readers.availability.listExceptionsForDoctor({
      doctorId: input.doctorId,
      start: day.start.toISOString(),
      end: day.end.toISOString(),
    }),
    readers.appointments.listActiveIntervals({
      doctorId: input.doctorId,
      start: day.start.toISOString(),
      end: day.end.toISOString(),
      excludeId: appointment.id,
    }),
  ]);

  const validation = validateAppointmentSlot({
    start: input.newScheduledAt,
    durationMinutes: appointment.durationMinutes,
    now: input.now ?? new Date(),
    schedules,
    blocks: blocks.map((block) => ({
      start: new Date(block.startsAt),
      end: new Date(block.endsAt),
    })),
    existing: existing.map((slot) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    })),
  });
  if (!validation.ok) {
    return { ok: false, message: RESCHEDULE_REJECTION_MESSAGES[validation.reason] };
  }

  const changed = await readers.appointments.reschedule({
    appointmentId: appointment.id,
    scheduledAt: input.newScheduledAt.toISOString(),
    rescheduledFromAt: appointment.scheduledAt,
  });
  if (!changed) {
    return {
      ok: false,
      message: "The appointment status just changed. Refresh and try again.",
    };
  }

  const note = input.note?.trim();
  await readers.appointments.insertHistory({
    appointmentId: appointment.id,
    fromStatus: appointment.status,
    toStatus: appointment.status,
    changedByProfileId: input.doctorId,
    reason: `Rescheduled from ${appointment.scheduledAt} to ${input.newScheduledAt.toISOString()}${note ? ` — ${note}` : ""}`,
    scheduledAtSnapshot: input.newScheduledAt.toISOString(),
  });
  return { ok: true };
}

/** Messages for the coded rejections raised by the booking function. */
const BOOKING_REJECTION_MESSAGES: Record<string, string> = {
  inactive_doctor: "This doctor is not accepting appointments.",
  past: "Choose a future appointment time.",
  outside_hours: "That time is outside the doctor's consultation hours.",
  blocked: "The doctor is unavailable at that time.",
};

const RAISED_EXCEPTION = "P0001";
const EXCLUSION_VIOLATION = "23P01";

/**
 * Books a slot for the session patient. Availability is re-checked and the
 * appointment plus its history row are written in one database transaction,
 * so a stale slot list cannot produce a double booking.
 */
export async function bookAppointment(
  input: {
    patientId: string;
    doctorId: string;
    scheduledAt: Date;
    reason: string | null;
  },
  booker: AppointmentBooker,
): Promise<{ ok: true; appointmentId: string } | { ok: false; message: string }> {
  const result = await booker.book({
    doctorId: input.doctorId,
    patientId: input.patientId,
    scheduledAt: input.scheduledAt.toISOString(),
    reason: input.reason,
  });
  if (result.ok) {
    return result;
  }

  const { code, message } = result.error;
  if (code === EXCLUSION_VIOLATION) {
    return { ok: false, message: "That slot was just booked. Choose another time." };
  }
  if (code === RAISED_EXCEPTION && Object.hasOwn(BOOKING_REJECTION_MESSAGES, message)) {
    return { ok: false, message: BOOKING_REJECTION_MESSAGES[message] };
  }
  throw new Error("Unable to book the appointment.");
}

function manilaDateOf(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Statistics over an arbitrary bounded period, aggregated from real rows. */
export async function getDoctorAppointmentStats(
  input: { doctorId: string; start: Date; end: Date },
  reader: DoctorAppointmentsReader,
) {
  const appointments = await reader.listForDoctor({
    doctorId: input.doctorId,
    start: input.start.toISOString(),
    end: input.end.toISOString(),
    status: null,
  });
  return summarizeAppointments(appointments);
}

/** Audit history grouped by appointment ID for a doctor-scoped set of IDs. */
export async function getAppointmentHistoryMap(
  input: { appointmentIds: string[] },
  reader: DoctorAppointmentsReader,
): Promise<Map<string, AppointmentHistoryEntry[]>> {
  if (input.appointmentIds.length === 0) {
    return new Map();
  }
  const entries = await reader.listHistory({
    appointmentIds: input.appointmentIds,
  });
  const map = new Map<string, AppointmentHistoryEntry[]>();
  for (const entry of entries) {
    const list = map.get(entry.appointmentId) ?? [];
    list.push(entry);
    map.set(entry.appointmentId, list);
  }
  return map;
}
