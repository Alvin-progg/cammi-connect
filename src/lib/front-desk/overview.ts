import type { AppointmentStatus, BookingSource } from "@/lib/appointments/status";

import { PATIENT_SEARCH_MAX_LENGTH } from "./booking";
import type { ScheduleItem } from "./schedule";

/** Dashboard overview (SPEC-frontdesk §4). */

/** Rows shown in each overview list; the full views hold the rest. */
export const OVERVIEW_LIST_LIMIT = 5;
export const OVERVIEW_SCHEDULE_LIMIT = 8;
export const APPOINTMENT_SEARCH_LIMIT = 20;
export const OVERVIEW_SEARCH_MAX_LENGTH = PATIENT_SEARCH_MAX_LENGTH;

/**
 * The summary cards. Pending counts every request still awaiting review, on
 * any date. The other three count actions taken during today's Manila day
 * (FD-001 PR 8 decision), not appointments scheduled today.
 */
export type OverviewCounts = {
  pending: number;
  confirmedToday: number;
  completedToday: number;
  cancelledToday: number;
};

/** An appointment in a "recently confirmed" or "recently rejected or cancelled" list. */
export type RecentAppointment = {
  id: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
  status: AppointmentStatus;
  /** When it was confirmed, rejected, or cancelled. */
  changedAt: string;
  /** The rejection or cancellation reason; null otherwise. */
  reason: string | null;
};

/** One quick-search result. */
export type AppointmentSearchItem = {
  id: string;
  patientName: string;
  patientPhone: string | null;
  doctorName: string;
  scheduledAt: string;
  status: AppointmentStatus;
  bookingSource: BookingSource;
};

type SearchParam = string | string[] | undefined;

/** Reads the overview's `q` parameter; validation happens in the service. */
export function parseOverviewSearch(params: { q?: SearchParam }): string | null {
  const value = Array.isArray(params.q) ? params.q[0] : params.q;
  const search = value?.trim().slice(0, OVERVIEW_SEARCH_MAX_LENGTH);
  return search || null;
}

export type TodaySummary = {
  total: number;
  confirmed: number;
  pending: number;
  checkedIn: number;
  completed: number;
  noShow: number;
  /** Start of the next confirmed visit at or after now, or null. */
  nextCheckIn: string | null;
};

/** Counts for the overview cards, from the Manila day's schedule. */
export function summarizeToday(items: ScheduleItem[], now: Date): TodaySummary {
  const count = (status: AppointmentStatus) => items.filter((item) => item.status === status).length;
  const upcoming = items
    .filter((item) => item.status === "confirmed" && new Date(item.scheduledAt).getTime() >= now.getTime())
    .map((item) => item.scheduledAt)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return {
    total: items.length,
    confirmed: count("confirmed"),
    pending: count("requested"),
    checkedIn: count("checked_in"),
    completed: count("completed"),
    noShow: count("no_show"),
    nextCheckIn: upcoming[0] ?? null,
  };
}

/** One activity feed: recently confirmed, rejected, and cancelled, newest first. */
export function mergeRecentActivity(
  confirmed: RecentAppointment[],
  closed: RecentAppointment[],
): RecentAppointment[] {
  return [...confirmed, ...closed].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  );
}
