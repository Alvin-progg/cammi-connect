import Link from "next/link";

import {
  calendarMonthLabel,
  shiftCalendarMonth,
} from "@/lib/appointments/dashboard";
import {
  ScheduleExceptionsSection,
  SchedulePeriodsSection,
} from "@/components/schedules/schedule-editor";
import type { CalendarMonthGrid } from "@/lib/schedules/calendar";
import {
  WEEKDAY_SHORT_LABELS,
  type ScheduleException,
  type WeeklySchedule,
} from "@/lib/schedules/types";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/lib/appointments/status";

const STATUS_DOT_CLASSES: Record<AppointmentStatus, string> = {
  requested: "bg-warning",
  confirmed: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-danger",
  no_show: "bg-ink-muted",
};

/**
 * Schedule & availability workspace: the doctor's own consultation periods,
 * schedule exceptions, and a Manila month calendar showing schedule days,
 * exceptions, and booked appointments.
 */
export function ScheduleManager({
  schedules,
  exceptions,
  month,
  today,
  grid,
}: {
  schedules: WeeklySchedule[];
  exceptions: ScheduleException[];
  month: string;
  today: string;
  grid: CalendarMonthGrid;
}) {
  return (
    <div className="flex flex-col gap-8">
      <SchedulePeriodsSection editor="doctor" schedules={schedules} today={today} />

      <ScheduleExceptionsSection editor="doctor" exceptions={exceptions} />

      <section aria-labelledby="calendar-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="calendar-heading" className="text-xl font-semibold text-ink">
            {calendarMonthLabel(month)}
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/doctor?view=calendar&month=${shiftCalendarMonth(month, -1)}`}
              className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted motion-reduce:transition-none"
            >
              Previous
            </Link>
            <Link
              href={`/doctor?view=calendar&month=${shiftCalendarMonth(month, 1)}`}
              className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted motion-reduce:transition-none"
            >
              Next
            </Link>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
          <div
            role="grid"
            aria-label={`Appointments and availability for ${calendarMonthLabel(month)}`}
          >
            <div role="row" className="grid grid-cols-7 border-b border-line bg-surface-muted">
              {WEEKDAY_SHORT_LABELS.map((label) => (
                <div
                  key={label}
                  role="columnheader"
                  className="px-2 py-2 text-center text-xs font-medium text-ink-secondary"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.days.map((day) => {
                const total = Object.values(day.counts).reduce(
                  (sum, count) => sum + (count ?? 0),
                  0,
                );
                return (
                  <div
                    key={day.date}
                    role="gridcell"
                    aria-label={`${day.date}${day.blocked ? ", blocked" : ""}${total > 0 ? `, ${total} appointment${total === 1 ? "" : "s"}` : ""}`}
                    className={`min-h-20 border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0 ${
                      day.inMonth ? "bg-surface" : "bg-surface-muted/60"
                    } ${day.isToday ? "outline-2 outline-offset-[-2px] outline-primary" : ""}`}
                  >
                    <p
                      className={`text-xs font-medium tabular-nums ${
                        day.inMonth ? "text-ink" : "text-ink-muted"
                      }`}
                    >
                      {day.dayOfMonth}
                    </p>
                    <div className="mt-1 flex flex-col gap-1">
                      {day.blocked ? (
                        <span className="inline-flex w-fit items-center rounded-full border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning-soft-ink">
                          Blocked
                        </span>
                      ) : null}
                      {total > 0 ? (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-ink-secondary">
                          {(Object.entries(day.counts) as [AppointmentStatus, number][]).map(
                            ([status, count]) =>
                              count > 0 ? (
                                <span
                                  key={status}
                                  title={`${APPOINTMENT_STATUS_LABELS[status]}: ${count}`}
                                  className="flex items-center gap-0.5"
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`size-1.5 rounded-full ${STATUS_DOT_CLASSES[status]}`}
                                  />
                                  <span className="sr-only">
                                    {APPOINTMENT_STATUS_LABELS[status]}: {count}
                                  </span>
                                  {count}
                                </span>
                              ) : null,
                          )}
                        </span>
                      ) : null}
                      {!day.blocked && day.hasSchedule && day.inMonth ? (
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <ul className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            Consultation day
          </li>
          {(Object.keys(STATUS_DOT_CLASSES) as AppointmentStatus[]).map(
            (status) => (
              <li key={status} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${STATUS_DOT_CLASSES[status]}`}
                />
                {APPOINTMENT_STATUS_LABELS[status]}
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
