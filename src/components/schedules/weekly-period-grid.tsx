import { formatClockTime } from "@/lib/appointments/format";
import { groupPeriodsByWeekday, periodEffectiveLabel } from "@/lib/schedules/calendar";
import { isScheduleEffectiveOn, type WeeklySchedule } from "@/lib/schedules/types";

/**
 * A read-only week of a doctor's consultation periods: Monday-to-Sunday
 * columns, each period a block with its hours and slot length. Periods that
 * are inactive or not in effect today are muted and labelled.
 */
export function WeeklyPeriodGrid({
  schedules,
  today,
}: {
  schedules: WeeklySchedule[];
  today: string;
}) {
  if (schedules.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
        No consultation periods yet.
      </p>
    );
  }

  return (
    <ol
      aria-label="Weekly consultation hours"
      className="grid gap-2 sm:grid-cols-7"
    >
      {groupPeriodsByWeekday(schedules).map((day) => (
        <li
          key={day.dayOfWeek}
          aria-label={day.label}
          className="flex min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-2"
        >
          <span aria-hidden="true" className="px-1 text-xs font-semibold text-ink-secondary">
            {day.label.slice(0, 3)}
          </span>
          {day.periods.length === 0 ? (
            <span className="px-1 text-xs text-ink-muted">Not available</span>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {day.periods.map((period) => (
                <PeriodBlock key={period.id} period={period} today={today} />
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

function PeriodBlock({ period, today }: { period: WeeklySchedule; today: string }) {
  const inEffect = isScheduleEffectiveOn(period, today);
  const live = period.isActive && inEffect;
  const note = !period.isActive ? "Inactive" : inEffect ? null : periodEffectiveLabel(period, today);

  return (
    <li
      className={`flex flex-col rounded-lg border px-2 py-1.5 text-xs tabular-nums ${
        live
          ? "border-primary/30 bg-primary-soft text-ink"
          : "border-dashed border-line-strong bg-surface-muted text-ink-muted"
      }`}
    >
      <span className="font-medium">
        {formatClockTime(period.startTime)} – {formatClockTime(period.endTime)}
      </span>
      <span>{period.slotDurationMinutes}-min slots</span>
      {note ? <span className="font-medium text-ink-secondary">{note}</span> : null}
    </li>
  );
}
