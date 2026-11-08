import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/data";
import { DataTable } from "@/components/analytics/data-table";
import { AUDIT_ACTION_LABELS } from "@/components/appointments/appointment-timeline";
import { formatRate } from "@/lib/analytics/display";
import type { DoctorAnalytics } from "@/lib/analytics/metrics";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { MONITORING_PATH } from "@/lib/appointments/monitoring";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import { formatRequestId } from "@/lib/front-desk/requests";
import type { AdminActivityEntry, AppointmentActivityEntry, PendingSummary } from "@/server/analytics/service";

const LIST_CLASS = "divide-y divide-line rounded-lg border border-line";

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  const headingId = `${id}-title`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-soft"
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink-secondary">{description}</p>
      </header>
      {children}
    </section>
  );
}

/** Read-only pending snapshot; the front desk works the queue (D3). */
export function PendingOverview({ pending }: { pending: PendingSummary }) {
  return (
    <Section id="pending-overview" title="Front desk queue" description="Requests waiting for confirmation right now. Read-only.">
      {pending.count === 0 ? (
        <EmptyState>No pending requests.</EmptyState>
      ) : (
        <>
          <p className="text-sm text-ink">
            <span className="text-2xl font-semibold tabular-nums">{pending.count}</span> pending
            {pending.oldestCreatedAt ? (
              <span className="ml-2 text-ink-secondary">
                Oldest waiting since {formatManilaDateTime(pending.oldestCreatedAt)}
              </span>
            ) : null}
          </p>
          <DataTable
            label="Pending requests by department"
            columns={["Department", "Pending"]}
            rows={pending.byDepartment.map((department) => [department.departmentName, department.count])}
          />
        </>
      )}
    </Section>
  );
}

export function DoctorPerformance({ doctors }: { doctors: DoctorAnalytics[] }) {
  return (
    <Section
      id="doctor-performance"
      title="Doctor performance"
      description="Top 5 doctors by appointments in range, with their no-show rate over finished visits."
    >
      {doctors.length === 0 ? (
        <EmptyState>No appointments were scheduled in this period.</EmptyState>
      ) : (
        <DataTable
          label="Doctor performance"
          columns={["Doctor", "Appointments", "Finished visits", "No-show rate"]}
          rows={doctors.map((doctor) => [doctor.doctorName, doctor.total, doctor.outcomeCount, formatRate(doctor.noShowRate)])}
        />
      )}
    </Section>
  );
}

export function AppointmentActivity({ entries }: { entries: AppointmentActivityEntry[] }) {
  return (
    <Section
      id="appointment-activity"
      title="Recent appointment activity"
      description="The latest status changes across the hospital."
    >
      {entries.length === 0 ? (
        <EmptyState>No appointment activity yet.</EmptyState>
      ) : (
        <ul className={LIST_CLASS}>
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium text-ink">
                  {AUDIT_ACTION_LABELS[entry.action]}
                  {entry.previousStatus && entry.previousStatus !== entry.newStatus ? (
                    <span className="ml-2 font-normal text-ink-secondary">
                      {APPOINTMENT_STATUS_LABELS[entry.previousStatus]} → {APPOINTMENT_STATUS_LABELS[entry.newStatus]}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-ink-muted">
                  {entry.actorName ?? "System"} · {formatManilaDateTime(entry.createdAt)}
                </span>
              </div>
              <Link
                href={`${MONITORING_PATH}/${entry.appointmentId}`}
                aria-label={`View appointment ${formatRequestId(entry.appointmentId)}`}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function SystemActivity({ entries }: { entries: AdminActivityEntry[] }) {
  return (
    <Section id="system-activity" title="System activity" description="The latest audited admin changes.">
      {entries.length === 0 ? (
        <EmptyState>No admin activity yet.</EmptyState>
      ) : (
        <ul className={LIST_CLASS}>
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 px-4 py-3">
              <code className="text-sm font-medium text-ink">{entry.action}</code>
              <span className="text-xs text-ink-muted">
                {entry.targetType} · {entry.actorName ?? "Unknown"} · {formatManilaDateTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
