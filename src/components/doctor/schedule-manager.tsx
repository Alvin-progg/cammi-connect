import Link from "next/link";

import {
  calendarMonthLabel,
  shiftCalendarMonth,
} from "@/lib/appointments/dashboard";
import {
  formatManilaDateTime,
  formatManilaTime,
} from "@/lib/appointments/format";
import type { CalendarMonthGrid } from "@/lib/schedules/calendar";
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT_LABELS,
  type BlockedSlot,
  type WeeklySchedule,
} from "@/lib/schedules/types";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/lib/appointments/status";

import { BlockSlotForm, RemoveBlockButton, ScheduleDayRow } from "./schedule-forms";

const STATUS_DOT_CLASSES: Record<AppointmentStatus, string> = {
  requested: "bg-warning",
  confirmed: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-danger",
  no_show: "bg-ink-muted",
};

/**
 * Schedule & availability workspace: weekly consultation hours editor,
 * blocked-slot manager, and a Manila month calendar showing schedule days,
 * blocks, and booked appointments.
 */
export function ScheduleManager({
  schedules,
  blocks,
  month,
  grid,
}: {
  schedules: WeeklySchedule[];
  blocks: BlockedSlot[];
  month: string;
  grid: CalendarMonthGrid;
}) {
  const scheduleByDay = new Map(
    schedules.map((schedule) => [schedule.dayOfWeek, schedule]),
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="weekly-hours-heading">
        <h2
          id="weekly-hours-heading"
          className="text-xl font-semibold text-ink"
        >
          Regular consultation hours
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          Set the days and hours you regularly see patients. Times are in
          Asia/Manila (PHT).
        </p>
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {WEEKDAY_LABELS.map((label, dayOfWeek) => (
            <ScheduleDayRow
              key={dayOfWeek}
              dayOfWeek={dayOfWeek}
              label={label}
              schedule={scheduleByDay.get(dayOfWeek) ?? null}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="blocked-slots-heading">
        <h2
          id="blocked-slots-heading"
          className="text-xl font-semibold text-ink"
        >
          Blocked dates and times
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">
          Block time you are unavailable — rounds, leave, or meetings. Blocked
          times are excluded from rescheduling.
        </p>
        <div className="mt-4">
          <BlockSlotForm />
        </div>
        {blocks.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
            No blocked times in this period.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {blocks.map((block) => (
              <li
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {block.reason}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatManilaDateTime(block.startsAt)} –{" "}
                    {formatManilaTime(block.endsAt)} PHT
                  </p>
                </div>
                <RemoveBlockButton blockId={block.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

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
