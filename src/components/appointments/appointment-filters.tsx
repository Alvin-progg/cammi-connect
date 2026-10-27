import Link from "next/link";

import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { AppointmentFilters as AppointmentFilterValues } from "@/lib/appointments/filters";

export function AppointmentFilters({
  filters,
}: {
  filters: AppointmentFilterValues;
}) {
  return (
    <section
      aria-labelledby="appointment-filters-heading"
      className="rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <h2
        id="appointment-filters-heading"
        className="text-sm font-semibold text-ink"
      >
        Filter appointments
      </h2>
      <form
        method="get"
        action="/doctor"
        className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,14rem)_auto] sm:items-end"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="appointment-date" className="text-sm font-medium text-ink">
            Date
          </label>
          <input
            id="appointment-date"
            name="date"
            type="date"
            defaultValue={filters.date}
            className="min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink focus-ring"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="appointment-status" className="text-sm font-medium text-ink">
            Status
          </label>
          <select
            id="appointment-status"
            name="status"
            defaultValue={filters.status ?? "all"}
            className="min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink focus-ring"
          >
            <option value="all">All statuses</option>
            {APPOINTMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {APPOINTMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover motion-reduce:transition-none"
          >
            Apply filters
          </button>
          <Link
            href="/doctor"
            className="rounded-lg text-sm font-medium text-primary underline underline-offset-4 focus-ring hover:text-primary-hover"
          >
            Reset
          </Link>
        </div>
      </form>
    </section>
  );
}
