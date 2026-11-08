import { z } from "zod";

import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { isValidManilaDate, todayInManila } from "@/lib/appointments/filters";
import {
  isAppointmentStatus,
  type AppointmentStatus,
  type BookingSource,
} from "@/lib/appointments/status";
import { canTransition } from "@/lib/appointments/transitions";

/** Statuses front desk staff set on the day of a visit (SPEC-frontdesk §8). */
export const ATTENDANCE_STATUSES = ["checked_in", "completed", "no_show"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_ACTION_LABELS: Record<AttendanceStatus, string> = {
  checked_in: "Check in",
  completed: "Mark completed",
  no_show: "Mark no-show",
};

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.some((status) => status === value);
}

/**
 * The attendance statuses staff may record now. Follows the lifecycle in
 * `canTransition`, and only from the appointment's Manila calendar day
 * onward (FD-001 PR 5 decision). The 0010 database function enforces the
 * same rules.
 */
export function allowedAttendanceActions(
  status: AppointmentStatus,
  scheduledAt: string,
  now: Date = new Date(),
): AttendanceStatus[] {
  if (todayInManila(new Date(scheduledAt)) > todayInManila(now)) {
    return [];
  }
  return ATTENDANCE_STATUSES.filter((target) => canTransition(status, target));
}

export const recordAttendanceSchema = z.object({
  appointmentId: z.uuid("Invalid appointment reference."),
  status: z.enum(ATTENDANCE_STATUSES, "Choose an attendance status."),
});

/** The day view shows at most this many appointments; staff narrow it with filters. */
export const SCHEDULE_LIMIT = 200;

export const SCHEDULE_SEARCH_MAX_LENGTH = 80;

export type ScheduleStatusFilter = AppointmentStatus | "all";

export type ScheduleFilters = {
  /** A Manila calendar date ("YYYY-MM-DD"). */
  date: string;
  doctorId: string | null;
  status: ScheduleStatusFilter;
  /** Case-insensitive part of a patient's name. */
  search: string | null;
};

/** One row of the daily schedule (SPEC-frontdesk §8). */
export type ScheduleItem = {
  id: string;
  patientName: string;
  doctorName: string;
  specialtyNames: string[];
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  bookingSource: BookingSource;
};

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseScheduleFilters(
  params: {
    date?: SearchParam;
    doctor?: SearchParam;
    status?: SearchParam;
    q?: SearchParam;
  },
  now: Date = new Date(),
): ScheduleFilters {
  const date = firstValue(params.date);
  const status = firstValue(params.status);
  const search = firstValue(params.q)?.trim().slice(0, SCHEDULE_SEARCH_MAX_LENGTH);

  return {
    date: date && isValidManilaDate(date) ? date : todayInManila(now),
    doctorId: parseRecordIdParam(params.doctor),
    status: status && isAppointmentStatus(status) ? status : "all",
    search: search || null,
  };
}

/** A Manila calendar date (`YYYY-MM-DD`) moved by whole days. */
export function shiftManilaDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
