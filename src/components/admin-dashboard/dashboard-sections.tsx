import { Clock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DataTable } from "@/components/analytics/data-table";
import { AUDIT_ACTION_LABELS } from "@/components/appointments/appointment-timeline";
import { CELL, EmptyState, HEADER_CELL } from "@/components/ui/data";
import { formatRate } from "@/lib/analytics/display";
import type { DoctorAnalytics } from "@/lib/analytics/metrics";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { monitoringListHref, MONITORING_PATH } from "@/lib/appointments/monitoring";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import { formatRequestId } from "@/lib/front-desk/requests";
import type { AdminActivityEntry, AppointmentActivityEntry, PendingSummary } from "@/server/analytics/service";

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

/** A bordered table for the activity feeds, with headers and cells the caller supplies. */
function ActivityTable({ label, headers, children }: { label: string; headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[640px] border-separate border-spacing-0">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className={HEADER_CELL}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Needs attention: the live front desk queue, read-only (D3). Built only from the pending snapshot. */
export function NeedsAttention({ pending }: { pending: PendingSummary }) {
  const reviewHref = monitoringListHref({
    search: "",
    doctorId: null,
    departmentId: null,
    statuses: ["requested"],
    source: null,
    from: null,
    to: null,
    page: 1,
  });

  return (
    <Section id="needs-attention" title="Needs attention" description="Requests waiting for the front desk right now.">
      {pending.count === 0 ? (
        <EmptyState>No pending requests.</EmptyState>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-line p-4">
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-ink"
            >
              <Clock className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium text-ink">
                {pending.count} {pending.count === 1 ? "request" : "requests"} waiting for confirmation
              </p>
              {pending.oldestCreatedAt ? (
                <p className="text-xs text-ink-muted">
                  Oldest waiting since {formatManilaDateTime(pending.oldestCreatedAt)}
                </p>
              ) : null}
            </div>
            <Link
              href={reviewHref}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
            >
              Review
            </Link>
          </div>
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
        <ActivityTable label="Recent appointment activity" headers={["Time", "Actor", "Action", "Record"]}>
          {entries.map((entry) => {
            const requestId = formatRequestId(entry.appointmentId);
            const previousStatus = entry.previousStatus;
            return (
              <tr key={entry.id}>
                <td className={`${CELL} whitespace-nowrap text-ink-secondary tabular-nums`}>
                  {formatManilaDateTime(entry.createdAt)}
                </td>
                <td className={CELL}>{entry.actorName ?? "System"}</td>
                <td className={CELL}>
                  {AUDIT_ACTION_LABELS[entry.action]}
                  {previousStatus && previousStatus !== entry.newStatus ? (
                    <span className="ml-2 text-ink-secondary">
                      {APPOINTMENT_STATUS_LABELS[previousStatus]} → {APPOINTMENT_STATUS_LABELS[entry.newStatus]}
                    </span>
                  ) : null}
                </td>
                <td className={CELL}>
                  <Link
                    href={`${MONITORING_PATH}/${entry.appointmentId}`}
                    aria-label={`View appointment ${requestId}`}
                    className="font-mono text-xs font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
                  >
                    {requestId}
                  </Link>
                </td>
              </tr>
            );
          })}
        </ActivityTable>
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
        <ActivityTable label="System activity" headers={["Time", "Actor", "Action", "Target"]}>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className={`${CELL} whitespace-nowrap text-ink-secondary tabular-nums`}>
                {formatManilaDateTime(entry.createdAt)}
              </td>
              <td className={CELL}>{entry.actorName ?? "Unknown"}</td>
              <td className={CELL}>
                <code className="font-mono text-xs">{entry.action}</code>
              </td>
              <td className={`${CELL} text-ink-secondary`}>{entry.targetType}</td>
            </tr>
          ))}
        </ActivityTable>
      )}
    </Section>
  );
}
