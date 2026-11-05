import type { AppointmentAuditAction } from "@/lib/appointments/audit";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import { USER_ROLE_LABELS } from "@/lib/auth/roles";
import type { RequestAuditEntry } from "@/lib/front-desk/requests";

const AUDIT_ACTION_LABELS: Record<AppointmentAuditAction, string> = {
  created: "Request submitted",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "Marked as no-show",
};

function actorLabel(entry: RequestAuditEntry): string {
  if (!entry.actorName) {
    return "System";
  }
  return entry.actorRole
    ? `${entry.actorName} (${USER_ROLE_LABELS[entry.actorRole]})`
    : entry.actorName;
}

/**
 * An appointment's `appointment_audit_logs` entries, oldest first: what
 * happened, who did it, and when. Shared by front desk request details and
 * admin monitoring.
 */
export function AppointmentTimeline({
  history,
  showStatusChange = false,
}: {
  history: RequestAuditEntry[];
  /** Adds a "from → to" status line to each entry (admin monitoring, ADM-09). */
  showStatusChange?: boolean;
}) {
  if (history.length === 0) {
    return <p className="text-sm text-ink-muted">No status changes recorded.</p>;
  }

  return (
    <ol className="flex flex-col gap-4 border-l border-line pl-4">
      {history.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink">{AUDIT_ACTION_LABELS[entry.action]}</span>
          <span className="text-xs text-ink-secondary">{actorLabel(entry)}</span>
          <time dateTime={entry.createdAt} className="text-xs text-ink-muted">
            {formatManilaDateTime(entry.createdAt)}
          </time>
          {showStatusChange ? (
            <span className="text-xs text-ink-secondary">
              {entry.previousStatus
                ? `${APPOINTMENT_STATUS_LABELS[entry.previousStatus]} → ${APPOINTMENT_STATUS_LABELS[entry.newStatus]}`
                : `Created as ${APPOINTMENT_STATUS_LABELS[entry.newStatus]}`}
            </span>
          ) : null}
          {entry.action === "rescheduled" && entry.scheduledAt ? (
            <span className="text-xs text-ink-secondary">
              {entry.previousScheduledAt
                ? `Moved from ${formatManilaDateTime(entry.previousScheduledAt)} to ${formatManilaDateTime(entry.scheduledAt)}`
                : `New time: ${formatManilaDateTime(entry.scheduledAt)}`}
            </span>
          ) : null}
          {entry.reason ? (
            <span className="text-xs text-ink-secondary">{`Reason: ${entry.reason}`}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
