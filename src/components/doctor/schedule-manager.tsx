import Link from "next/link";
import type { CSSProperties } from "react";

import {
  calendarMonthLabel,
  shiftCalendarMonth,
} from "@/lib/appointments/dashboard";
import { formatManilaDate } from "@/lib/appointments/format";
import {
  ScheduleExceptionsSection,
  SchedulePeriodsSection,
} from "@/components/schedules/schedule-editor";
import type {
  CalendarDaySummary,
  CalendarMonthGrid,
} from "@/lib/schedules/calendar";
import {
  SCHEDULE_EXCEPTION_LABELS,
  WEEKDAY_SHORT_LABELS,
  type ScheduleException,
  type WeeklySchedule,
} from "@/lib/schedules/types";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/lib/appointments/status";

import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const STATUS_DOT_CLASSES: Record<AppointmentStatus, string> = {
  requested: "bg-warning",
  confirmed: "bg-primary",
  rejected: "bg-danger",
  checked_in: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-danger",
  no_show: "bg-ink-muted",
};

/** Diagonal hatch marking a whole day the doctor is unavailable. */
const BLOCKED_HATCH: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--line-strong) 0 1px, transparent 1px 7px)",
};

const NAV_LINK_CLASS =
  "focus-ring inline-flex min-h-9 items-center justify-center px-3 text-sm font-medium text-ink pressable hover:bg-surface-muted";

function appointmentTotal(day: CalendarDaySummary): number {
  return Object.values(day.counts).reduce((sum, count) => sum + (count ?? 0), 0);
}

/** Everything a sighted user reads off a day cell, as one sentence. */
function dayAccessibleName(day: CalendarDaySummary, total: number): string {
  const parts = [formatManilaDate(day.date)];
  if (day.isToday) {
    parts.push("today");
  }
  if (day.hasSchedule) {
    parts.push("consultation day");
  }
  if (day.block) {
    parts.push(
      `${SCHEDULE_EXCEPTION_LABELS[day.block.type]}: ${day.block.reason}`,
      day.block.allDay ? "all day" : "part of the day",
    );
  }
  if (total > 0) {
    parts.push(`${total} appointment${total === 1 ? "" : "s"}`);
  }
  return parts.join(", ");
}

function dayBackground(day: CalendarDaySummary): string {
  if (!day.inMonth) {
    return "bg-surface-muted/60";
  }
  if (day.block?.allDay) {
    return "bg-surface-muted";
  }
  return day.hasSchedule ? "bg-accent-soft/50" : "bg-surface";
}

function DayCellContent({ day }: { day: CalendarDaySummary }) {
  return (
    <>
      <span
        className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
          day.isToday
            ? "bg-primary font-semibold text-primary-ink"
            : day.inMonth
              ? "font-medium text-ink"
              : "text-ink-muted"
        }`}
      >
        {day.dayOfMonth}
      </span>

      {day.block && day.inMonth ? (
        <span
          className={`max-w-full truncate rounded-full border px-1.5 py-0.5 text-[0.625rem] font-medium text-warning-soft-ink ${
            day.block.allDay
              ? "border-warning/30 bg-warning-soft"
              : "border-dashed border-warning/40 bg-surface"
          }`}
        >
          {SCHEDULE_EXCEPTION_LABELS[day.block.type]}
        </span>
      ) : null}

      {day.inMonth ? (
        <span className="mt-auto flex flex-wrap gap-1">
          {(Object.entries(day.counts) as [AppointmentStatus, number][]).map(
            ([status, count]) =>
              count > 0 ? (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 rounded-full bg-surface px-1.5 py-0.5 text-[0.625rem] font-medium tabular-nums text-ink-secondary shadow-card"
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${STATUS_DOT_CLASSES[status]}`}
                  />
                  {count}
                </span>
              ) : null,
          )}
        </span>
      ) : null}
    </>
  );
}

function MonthCalendar({ month, grid }: { month: string; grid: CalendarMonthGrid }) {
  const weeks = Array.from({ length: grid.days.length / 7 }, (_, week) =>
    grid.days.slice(week * 7, week * 7 + 7),
  );

  return (
    <section aria-labelledby="calendar-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="calendar-heading" className="text-xl font-semibold text-ink">
          {calendarMonthLabel(month)}
        </h2>
        <nav
          aria-label="Month"
          className="inline-flex divide-x divide-line-strong overflow-hidden rounded-lg border border-line-strong bg-surface"
        >
          <Link
            href={`/doctor?view=calendar&month=${shiftCalendarMonth(month, -1)}`}
            aria-label="Previous month"
            className={NAV_LINK_CLASS}
          >
            <ChevronLeftIcon className="size-4" />
          </Link>
          <Link href="/doctor?view=calendar" className={NAV_LINK_CLASS}>
            Today
          </Link>
          <Link
            href={`/doctor?view=calendar&month=${shiftCalendarMonth(month, 1)}`}
            aria-label="Next month"
            className={NAV_LINK_CLASS}
          >
            <ChevronRightIcon className="size-4" />
          </Link>
        </nav>
      </div>

      <div
        role="grid"
        aria-label={`Availability and appointments for ${calendarMonthLabel(month)}`}
        className="mt-4 overflow-hidden rounded-xl border border-line bg-surface"
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

        {weeks.map((week) => (
          <div
            key={week[0].date}
            role="row"
            className="grid grid-cols-7 border-b border-line last:border-b-0"
          >
            {week.map((day) => {
              const total = appointmentTotal(day);
              const cellClass = `flex h-full min-h-20 flex-col items-start gap-1 p-1.5 sm:min-h-24 ${dayBackground(day)}`;
              const hatch = day.inMonth && day.block?.allDay ? BLOCKED_HATCH : undefined;

              return (
                <div
                  key={day.date}
                  role="gridcell"
                  className="min-w-0 border-r border-line last:border-r-0"
                >
                  {day.inMonth ? (
                    <Link
                      href={`/doctor?view=week&week=${day.date}`}
                      aria-label={dayAccessibleName(day, total)}
                      title={
                        day.block
                          ? `${SCHEDULE_EXCEPTION_LABELS[day.block.type]}: ${day.block.reason}`
                          : undefined
                      }
                      style={hatch}
                      className={`focus-ring ${cellClass} transition-[box-shadow,background-color] duration-150 ease-snappy hover:ring-2 hover:ring-inset hover:ring-primary/30 active:bg-primary-soft motion-reduce:transition-none`}
                    >
                      <DayCellContent day={day} />
                    </Link>
                  ) : (
                    <div aria-label={formatManilaDate(day.date)} className={cellClass}>
                      <DayCellContent day={day} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded-sm border border-line bg-accent-soft"
          />
          Consultation day
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={BLOCKED_HATCH}
            className="size-3 rounded-sm border border-line bg-surface-muted"
          />
          Blocked
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded-sm border border-dashed border-warning/60 bg-surface"
          />
          Partly blocked
        </li>
        {(Object.keys(STATUS_DOT_CLASSES) as AppointmentStatus[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${STATUS_DOT_CLASSES[status]}`}
            />
            {APPOINTMENT_STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Schedule & availability workspace. The month calendar comes first as the
 * read-only overview (each day opens its week); the weekly hours and the
 * exceptions below are where the doctor edits it.
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
    <div className="flex flex-col gap-10">
      <MonthCalendar month={month} grid={grid} />

      <SchedulePeriodsSection editor="doctor" schedules={schedules} today={today} />

      <ScheduleExceptionsSection editor="doctor" exceptions={exceptions} />
    </div>
  );
}
