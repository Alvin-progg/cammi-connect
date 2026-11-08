import { parseRecordIdParam } from "@/lib/admin/dashboard";
import type { AppointmentAuditAction } from "@/lib/appointments/audit";
import { isValidManilaDate } from "@/lib/appointments/filters";
import type { AppointmentStatus, BookingSource } from "@/lib/appointments/status";
import type { UserRole } from "@/lib/auth/roles";

/**
 * Status filters for the front desk request queue (SPEC-frontdesk §5).
 * `pending` is the stored `requested` status; `all` applies no status filter.
 */
export const REQUEST_STATUS_FILTERS = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "all",
] as const;

export type RequestStatusFilter = (typeof REQUEST_STATUS_FILTERS)[number];

export const REQUEST_STATUS_FILTER_LABELS: Record<RequestStatusFilter, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  all: "All statuses",
};

export const BOOKING_SOURCE_LABELS: Record<BookingSource, string> = {
  ai_chatbot: "Cami (AI assistant)",
  front_desk: "Front desk",
  other: "Other",
};

/** The queue shows at most this many requests; staff narrow it with filters. */
export const REQUEST_QUEUE_LIMIT = 100;

export type RequestQueueFilters = {
  status: RequestStatusFilter;
  /** A Manila calendar date ("YYYY-MM-DD") for the requested appointment day. */
  date: string | null;
  doctorId: string | null;
  specialtyId: string | null;
};

/** One row of the request queue. Contact fields are null when not on file. */
export type RequestQueueItem = {
  id: string;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string | null;
  doctorName: string;
  /** The requested specialty, or the doctor's specialties when none was recorded. */
  specialtyNames: string[];
  scheduledAt: string;
  durationMinutes: number;
  createdAt: string;
  status: AppointmentStatus;
};

/** One `appointment_audit_logs` entry with the actor's name resolved. */
export type RequestAuditEntry = {
  id: string;
  action: AppointmentAuditAction;
  previousStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  /** Null when the entry has no actor or the actor's profile is gone. */
  actorName: string | null;
  actorRole: UserRole | null;
  reason: string | null;
  scheduledAt: string | null;
  /** The time before a reschedule, from `previous_values`; null otherwise. */
  previousScheduledAt: string | null;
  createdAt: string;
};

/**
 * Everything staff need to evaluate a request (SPEC-frontdesk §5, Request
 * Details). Chat transcripts are deliberately not included (FD-001 decision
 * 2026-11-03).
 */
export type RequestDetails = RequestQueueItem & {
  /** Used server-side for the schedule check; not displayed. */
  doctorId: string;
  bookingSource: BookingSource;
  reason: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  history: RequestAuditEntry[];
};

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRequestQueueFilters(params: {
  status?: SearchParam;
  date?: SearchParam;
  doctor?: SearchParam;
  specialty?: SearchParam;
}): RequestQueueFilters {
  const status = firstValue(params.status);
  const date = firstValue(params.date);

  return {
    status: REQUEST_STATUS_FILTERS.find((filter) => filter === status) ?? "pending",
    date: date && isValidManilaDate(date) ? date : null,
    doctorId: parseRecordIdParam(params.doctor),
    specialtyId: parseRecordIdParam(params.specialty),
  };
}

/** A short, readable request reference: the first eight id characters. */
export function formatRequestId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export type RequestView = "board" | "list";

/** `?view=` on the request queue; the board is the default. */
export function parseRequestView(params: { view?: SearchParam }): RequestView {
  return firstValue(params.view) === "list" ? "list" : "board";
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** A pending request is overdue once it has waited a full day. */
const OVERDUE_MS = DAY_MS;

/** How long a request has waited since it was submitted ("40 min", "18 h", "3 d"). */
export function formatWaiting(createdAt: string, now: Date): { label: string; overdue: boolean } {
  const waited = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  const label =
    waited < HOUR_MS
      ? `${Math.max(1, Math.floor(waited / MINUTE_MS))} min`
      : waited < 2 * DAY_MS
        ? `${Math.floor(waited / HOUR_MS)} h`
        : `${Math.floor(waited / DAY_MS)} d`;
  return { label, overdue: waited >= OVERDUE_MS };
}

export type RequestBoardColumn = {
  key: "pending" | "confirmed" | "checked_in" | "closed";
  title: string;
  items: RequestQueueItem[];
};

/**
 * The request board's four columns. Completed and no-show visits are finished,
 * so the board leaves them out; the list view still shows them.
 */
export function groupRequestBoard(items: RequestQueueItem[]): RequestBoardColumn[] {
  const pick = (...statuses: AppointmentStatus[]) => items.filter((item) => statuses.includes(item.status));
  return [
    { key: "pending", title: "Pending confirmation", items: pick("requested") },
    { key: "confirmed", title: "Confirmed", items: pick("confirmed") },
    { key: "checked_in", title: "Checked in", items: pick("checked_in") },
    { key: "closed", title: "Cancelled or rejected", items: pick("rejected", "cancelled") },
  ];
}

/**
 * Where a request sits in the pending queue (oldest first) and which one to
 * open next; wraps to the first. Null when the request is not pending.
 */
export function nextPendingRequest(
  pendingIds: string[],
  currentId: string,
): { position: number; total: number; nextId: string | null } | null {
  const index = pendingIds.indexOf(currentId);
  if (index === -1) return null;
  const total = pendingIds.length;
  return {
    position: index + 1,
    total,
    nextId: total > 1 ? pendingIds[(index + 1) % total] : null,
  };
}
