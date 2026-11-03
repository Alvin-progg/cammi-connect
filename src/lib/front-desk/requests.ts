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
