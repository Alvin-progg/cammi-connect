import Link from "next/link";

import {
  STATS_PERIOD_LABELS,
  STATS_PERIODS,
  type StatsPeriod,
} from "@/lib/appointments/dashboard";
import type { AppointmentStatsSummary } from "@/lib/appointments/stats";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/lib/appointments/status";

function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm font-medium text-ink-secondary">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-ink-muted">{detail}</p>
      ) : null}
    </div>
  );
}

const DAY_STATUSES: AppointmentStatus[] = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

/**
 * Appointment statistics: KPI cards, a measured per-day bar chart, and the
 * required accessible table alternative. All values come from authoritative
 * appointment rows — nothing is extrapolated or generated.
 */
export function DoctorStatsPanel({
  stats,
  period,
}: {
  stats: AppointmentStatsSummary;
  period: StatsPeriod;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div
        role="group"
        aria-label="Statistics period"
        className="flex w-fit items-center gap-1 rounded-lg border border-line bg-surface-muted p-1"
      >
        {STATS_PERIODS.map((item) => {
          const active = item === period;
          return (
            <Link
              key={item}
              href={`/doctor?view=stats&period=${item}`}
              aria-current={active ? "true" : undefined}
              className={`focus-ring rounded-md px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-surface text-primary shadow-card"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {STATS_PERIOD_LABELS[item]}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total appointments"
          value={String(stats.total)}
          detail={STATS_PERIOD_LABELS[period]}
        />
        <KpiCard
          label="Completed"
          value={String(stats.completed)}
          detail={
            stats.completionRate === null
              ? "No closed appointments yet"
              : `${stats.completionRate}% completion rate`
          }
        />
        <KpiCard label="Cancelled" value={String(stats.cancelled)} />
        <KpiCard label="No-show" value={String(stats.noShow)} />
      </div>

      <section
        aria-labelledby="trend-heading"
        className="rounded-xl border border-line bg-surface p-4 sm:p-6"
      >
        <h2 id="trend-heading" className="text-xl font-semibold text-ink">
          Appointments per day
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          Measured data from your appointment records, grouped by Manila
          calendar day.
        </p>

        {stats.days.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-sm text-ink-muted">
            No appointments recorded for this period.
          </p>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="mt-6 flex h-40 items-end gap-1 border-b border-line pb-0"
            >
              {stats.days.map((day) => (
                <div
                  key={day.date}
                  className="flex min-w-2 flex-1 flex-col items-center justify-end"
                >
                  <div
                    className="w-full max-w-10 rounded-t-md bg-chart-1"
                    style={{
                      height: `${Math.max(
                        (day.total / (stats.maxDayTotal || 1)) * 100,
                        4,
                      )}%`,
                    }}
                    title={`${day.date}: ${day.total}`}
                  />
                </div>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="mt-1 flex gap-1 text-[10px] text-ink-muted"
            >
              {stats.days.map((day, index) => (
                <div key={day.date} className="min-w-2 flex-1 truncate text-center">
                  {index % Math.ceil(stats.days.length / 10 || 1) === 0
                    ? day.date.slice(5)
                    : ""}
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-x-auto" role="region" aria-label="Daily appointment counts table" tabIndex={0}>
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <caption className="sr-only">
                  Daily appointment counts by status
                </caption>
                <thead className="bg-surface-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 text-sm font-medium text-ink-secondary">
                      Date
                    </th>
                    {DAY_STATUSES.map((status) => (
                      <th
                        key={status}
                        scope="col"
                        className="px-3 py-2.5 text-right text-sm font-medium text-ink-secondary"
                      >
                        {APPOINTMENT_STATUS_LABELS[status]}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-2.5 text-right text-sm font-medium text-ink-secondary">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.days.map((day) => (
                    <tr key={day.date} className="border-t border-line">
                      <th
                        scope="row"
                        className="whitespace-nowrap px-3 py-2.5 text-sm font-medium tabular-nums text-ink"
                      >
                        {day.date}
                      </th>
                      {DAY_STATUSES.map((status) => (
                        <td
                          key={status}
                          className="px-3 py-2.5 text-right text-sm tabular-nums text-ink-secondary"
                        >
                          {day.counts[status]}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-ink">
                        {day.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
