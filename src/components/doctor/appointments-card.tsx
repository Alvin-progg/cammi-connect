import Link from "next/link";
import type { ReactNode } from "react";

import { shiftWeek, weekRangeLabel } from "@/lib/appointments/dashboard";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
} from "@/lib/appointments/status";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "./icons";

const PRESSABLE =
  "focus-ring transition-[color,background-color,box-shadow,transform] duration-150 ease-snappy active:scale-[0.97] motion-reduce:transition-none";
const CONTROL =
  "min-h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink focus-ring";

function doctorHref(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  return `/doctor?${search.toString()}`;
}

function WeekNavigator({
  weekStart,
  currentWeekStart,
  status,
}: {
  weekStart: string;
  currentWeekStart: string;
  status: AppointmentStatus | null;
}) {
  const stepClass = `${PRESSABLE} inline-flex size-8 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-muted hover:text-ink`;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-line bg-surface py-1 pl-3 pr-1 shadow-card">
        <CalendarIcon className="size-4 text-ink-muted" />
        <span className="mr-1 whitespace-nowrap text-sm font-semibold tabular-nums text-ink">
          {weekRangeLabel(weekStart)}
        </span>
        <Link
          href={doctorHref({ view: "week", week: shiftWeek(weekStart, -1), status })}
          aria-label="Previous week"
          className={stepClass}
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
        <Link
          href={doctorHref({ view: "week", week: shiftWeek(weekStart, 1), status })}
          aria-label="Next week"
          className={stepClass}
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      {weekStart !== currentWeekStart ? (
        <Link
          href={doctorHref({ view: "week", status })}
          className={`${PRESSABLE} rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary hover:bg-primary-soft`}
        >
          This week
        </Link>
      ) : null}
    </div>
  );
}

/**
 * White card holding the weekly appointments schedule: week navigator,
 * Block time, and the status filter.
 */
export function AppointmentsCard({
  weekStart,
  currentWeekStart,
  status,
  summary,
  children,
}: {
  weekStart: string;
  currentWeekStart: string;
  status: AppointmentStatus | null;
  summary: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="appointments-heading"
      className="rounded-2xl border border-line bg-surface shadow-card"
    >
      <h2 id="appointments-heading" className="sr-only">
        Appointments
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <WeekNavigator
          weekStart={weekStart}
          currentWeekStart={currentWeekStart}
          status={status}
        />

        <Link
          href="/doctor?view=calendar"
          className={`${PRESSABLE} inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-ink hover:bg-primary-hover`}
        >
          <PlusIcon className="size-4" />
          Block time
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <p className="text-sm text-ink-muted" role="status">
          {summary}
        </p>
        <form method="get" action="/doctor" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="view" value="week" />
          <input type="hidden" name="week" value={weekStart} />
          <label htmlFor="filter-status" className="sr-only">
            Status
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={status ?? "all"}
            className={CONTROL}
          >
            <option value="all">All statuses</option>
            {APPOINTMENT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {APPOINTMENT_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className={`${PRESSABLE} inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-primary hover:bg-primary-soft`}
          >
            Apply
          </button>
        </form>
      </div>

      {children}
    </section>
  );
}
