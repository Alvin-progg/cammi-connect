import { z } from "zod";

import { parseRecordIdParam } from "@/lib/admin/dashboard";
import type { RequestAuditEntry } from "@/lib/front-desk/requests";

import { isValidManilaDate, manilaDayRange } from "./filters";
import {
  APPOINTMENT_STATUSES,
  BOOKING_SOURCES,
  type AppointmentStatus,
  type BookingSource,
} from "./status";

/** Admin appointment monitoring (spec-admin ADM-09). Read-only: no status changes (D3). */
export const MONITORING_PATH = "/admin/appointments";

export const MONITORING_PAGE_SIZE = 25;

const SEARCH_MAX_LENGTH = 100;

export type AppointmentMonitoringFilters = {
  /** Patient name, matched as a case-insensitive substring. */
  search: string;
  doctorId: string | null;
  departmentId: string | null;
  /** Empty means every status. */
  statuses: AppointmentStatus[];
  source: BookingSource | null;
  /** Manila calendar dates ("YYYY-MM-DD") of the scheduled day, both inclusive. */
  from: string | null;
  to: string | null;
  page: number;
};

/**
 * One row of the monitoring table. Privacy (ADM-09): the list carries only the
 * patient's name and id, never contact details.
 */
export type MonitoringListItem = {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  departmentName: string | null;
  specialtyName: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  bookingSource: BookingSource;
  createdByName: string | null;
  confirmedByName: string | null;
};

/** The detail page: every list field plus contact details, reasons, and the status timeline. */
export type MonitoringDetails = MonitoringListItem & {
  patientEmail: string | null;
  patientPhone: string | null;
  createdAt: string;
  confirmedAt: string | null;
  reason: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  history: RequestAuditEntry[];
};

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function allValues(value: SearchParam): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseManilaDate(value: SearchParam): string | null {
  const date = firstValue(value);
  return date && isValidManilaDate(date) ? date : null;
}

/** Monitoring filters from search params; anything invalid falls back to its default. */
export function parseAppointmentMonitoringFilters(params: {
  q?: SearchParam;
  doctor?: SearchParam;
  department?: SearchParam;
  status?: SearchParam;
  source?: SearchParam;
  from?: SearchParam;
  to?: SearchParam;
  page?: SearchParam;
}): AppointmentMonitoringFilters {
  const requestedStatuses = new Set(allValues(params.status));
  const source = z.enum(BOOKING_SOURCES).safeParse(firstValue(params.source));
  const page = z.coerce.number().int().min(1).safeParse(firstValue(params.page));

  let from = parseManilaDate(params.from);
  let to = parseManilaDate(params.to);
  // ISO dates compare correctly as strings.
  if (from && to && from > to) {
    [from, to] = [to, from];
  }

  return {
    search: (firstValue(params.q) ?? "").trim().slice(0, SEARCH_MAX_LENGTH),
    doctorId: parseRecordIdParam(params.doctor),
    departmentId: parseRecordIdParam(params.department),
    // Canonical order, so the same selection always produces the same URL.
    statuses: APPOINTMENT_STATUSES.filter((status) => requestedStatuses.has(status)),
    source: source.success ? source.data : null,
    from,
    to,
    page: page.success ? page.data : 1,
  };
}

/** UTC bounds of the scheduled-date filter: start of `from`, end of `to` (exclusive). */
export function monitoringDateBounds(
  filters: Pick<AppointmentMonitoringFilters, "from" | "to">,
): { start: string | null; end: string | null } {
  return {
    start: filters.from ? manilaDayRange(filters.from).start.toISOString() : null,
    end: filters.to ? manilaDayRange(filters.to).end.toISOString() : null,
  };
}

/** The monitoring list URL for a page, keeping the active filters (shareable, dashboard deep links). */
export function monitoringListHref(filters: AppointmentMonitoringFilters, page = filters.page): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.doctorId) params.set("doctor", filters.doctorId);
  if (filters.departmentId) params.set("department", filters.departmentId);
  for (const status of filters.statuses) params.append("status", status);
  if (filters.source) params.set("source", filters.source);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${MONITORING_PATH}?${query}` : MONITORING_PATH;
}
