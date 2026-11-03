import type { AppointmentStatus } from "./status";

/** Values of `appointment_audit_logs.action` (FD-001). */
export const APPOINTMENT_AUDIT_ACTIONS = [
  "created",
  "confirmed",
  "rejected",
  "cancelled",
  "rescheduled",
  "checked_in",
  "completed",
  "no_show",
] as const;

export type AppointmentAuditAction =
  (typeof APPOINTMENT_AUDIT_ACTIONS)[number];

/**
 * Derives the audit action from a status change. A missing previous status is
 * the creation entry, and an unchanged status is a reschedule. Every other
 * change is named after its new status, which the migration's backfill of
 * `appointment_status_history` mirrors.
 */
export function auditActionFor(
  previousStatus: AppointmentStatus | null,
  newStatus: AppointmentStatus,
): AppointmentAuditAction {
  if (previousStatus === null) {
    if (newStatus !== "requested") {
      throw new Error("An appointment must be created as requested.");
    }
    return "created";
  }
  if (previousStatus === newStatus) {
    return "rescheduled";
  }
  if (newStatus === "requested") {
    throw new Error("An appointment cannot return to requested.");
  }
  return newStatus;
}

/**
 * Reads the `scheduled_at` snapshot from an audit row's `new_values` JSON.
 * The column is untyped JSONB, so anything without a string snapshot is null.
 */
export function scheduledAtFromAuditValues(values: unknown): string | null {
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    return null;
  }
  const scheduledAt: unknown = Reflect.get(values, "scheduled_at");
  return typeof scheduledAt === "string" ? scheduledAt : null;
}
