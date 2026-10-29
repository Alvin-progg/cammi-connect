"use client";

import { useCallback, useRef, useState } from "react";

import { formatManilaDate, formatManilaTime } from "@/lib/appointments/format";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { WeekBlock, WeekLayout } from "@/lib/appointments/week";

import type { AppointmentHistoryItem } from "./appointment-actions";
import { patientInitials, SLOT_TONES } from "./slot-tones";
import { WeekSlotPopover } from "./week-slot-popover";

/**
 * Height of one hour row. A 30-minute slot (3.5rem) must fit the name row and
 * the time line plus the block's padding and border without clipping.
 */
const HOUR_ROW_REM = 7;
/** Long enough to show the reason line inside the block. */
const REASON_MIN_MINUTES = 60;

function hourLabel(hour: number): string {
  const suffix = hour < 12 || hour === 24 ? "AM" : "PM";
  return `${hour % 12 || 12} ${suffix}`;
}

function WeekSlot({
  block,
  isOpen,
  onToggle,
  onClose,
  history,
  scheduleHint,
  registerTrigger,
}: {
  block: WeekBlock;
  isOpen: boolean;
  onToggle: () => void;
  onClose: (options: { restoreFocus: boolean }) => void;
  history: AppointmentHistoryItem[];
  scheduleHint: string;
  registerTrigger: (element: HTMLButtonElement | null) => void;
}) {
  const { appointment } = block;
  const tone = SLOT_TONES[appointment.status];
  const timeRange = `${formatManilaTime(appointment.scheduledAt)} – ${formatManilaTime(block.endsAt)}`;
  const popoverId = `slot-popover-${appointment.id}`;
  const laneWidth = 100 / block.laneCount;

  return (
    <div
      className={`absolute px-1 py-0.5 ${isOpen ? "z-30" : "z-10"}`}
      style={{
        top: `${block.topPct}%`,
        height: `${block.heightPct}%`,
        left: `${block.lane * laneWidth}%`,
        width: `${laneWidth}%`,
      }}
    >
      <button
        ref={registerTrigger}
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        aria-label={`${appointment.patientName}, ${timeRange}, ${APPOINTMENT_STATUS_LABELS[appointment.status]}`}
        onClick={onToggle}
        className={`focus-ring flex h-full w-full min-w-0 flex-col overflow-hidden rounded-lg border px-2 py-1 text-left transition-[transform,box-shadow] duration-150 ease-snappy active:scale-[0.97] motion-reduce:transition-none ${tone.fill} ${tone.edge} ${
          isOpen ? "shadow-card ring-2 ring-primary/40" : ""
        } ${appointment.status === "cancelled" || appointment.status === "no_show" ? "opacity-75" : ""}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface text-[0.625rem] font-semibold text-ink-secondary"
          >
            {patientInitials(appointment.patientName)}
          </span>
          <span className="truncate text-xs font-semibold text-ink">
            {appointment.patientName}
          </span>
        </span>
        {appointment.durationMinutes >= REASON_MIN_MINUTES ? (
          <span className="mt-1 truncate text-xs text-ink-secondary">
            {appointment.reason ?? "General consultation"}
          </span>
        ) : null}
        <span className="mt-auto truncate text-[0.6875rem] tabular-nums text-ink-secondary">
          {timeRange}
        </span>
      </button>

      {isOpen ? (
        <WeekSlotPopover
          id={popoverId}
          block={block}
          timeRange={timeRange}
          history={history}
          scheduleHint={scheduleHint}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}

/**
 * Weekly time grid for the doctor's appointments. Blocks are positioned from
 * the pure `buildWeekLayout`; clicking one opens a detail popover with the
 * existing appointment actions. Only one popover is open at a time.
 */
export function WeekSchedule({
  layout,
  historyById,
  scheduleHint,
}: {
  layout: WeekLayout;
  historyById: Record<string, AppointmentHistoryItem[]>;
  scheduleHint: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  const close = useCallback(
    (id: string, { restoreFocus }: { restoreFocus: boolean }) => {
      setOpenId((current) => (current === id ? null : current));
      if (restoreFocus) {
        triggers.current.get(id)?.focus();
      }
    },
    [],
  );

  const bodyHeight = `${layout.hours.length * HOUR_ROW_REM}rem`;
  const columns = "grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";

  return (
    <div
      role="region"
      aria-label="Week schedule"
      tabIndex={0}
      className="focus-ring overflow-x-auto rounded-b-2xl"
    >
      <div className="min-w-[56rem]">
        <div className={`grid ${columns} border-b border-line`}>
          <div className="flex items-end justify-center pb-3 text-[0.6875rem] font-medium text-ink-muted">
            GMT+8
          </div>
          {layout.days.map((day) => (
            <div
              key={day.date}
              aria-hidden="true"
              className="flex flex-col items-center gap-1 border-l border-line py-3"
            >
              <span
                className={`text-xs font-medium uppercase tracking-wide ${
                  day.isToday ? "text-primary" : "text-ink-muted"
                }`}
              >
                {day.weekdayLabel}
              </span>
              <span
                className={`flex size-8 items-center justify-center rounded-full text-lg tabular-nums ${
                  day.isToday
                    ? "bg-primary font-semibold text-primary-ink"
                    : "text-ink"
                }`}
              >
                {day.dayNumber}
              </span>
            </div>
          ))}
        </div>

        <div className={`relative grid ${columns}`} style={{ height: bodyHeight }}>
          <div aria-hidden="true" className="relative">
            {layout.hours.map((hour, index) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[0.6875rem] tabular-nums text-ink-muted first:translate-y-1"
                style={{ top: `${(index / layout.hours.length) * 100}%` }}
              >
                {hourLabel(hour)}
              </span>
            ))}
          </div>

          {layout.days.map((day, dayIndex) => (
            <div
              key={day.date}
              role="group"
              aria-label={formatManilaDate(day.date)}
              className={`relative border-l border-line ${day.isToday ? "bg-primary-soft/40" : ""}`}
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, var(--line) 1px, transparent 1px)",
                backgroundSize: `100% ${HOUR_ROW_REM}rem`,
              }}
            >
              {layout.blocks
                .filter((block) => block.dayIndex === dayIndex)
                .map((block) => {
                  const id = block.appointment.id;
                  return (
                    <WeekSlot
                      key={id}
                      block={block}
                      isOpen={openId === id}
                      onToggle={() =>
                        setOpenId((current) => (current === id ? null : id))
                      }
                      onClose={(options) => close(id, options)}
                      history={historyById[id] ?? []}
                      scheduleHint={scheduleHint}
                      registerTrigger={(element) => {
                        if (element) {
                          triggers.current.set(id, element);
                        } else {
                          triggers.current.delete(id);
                        }
                      }}
                    />
                  );
                })}
            </div>
          ))}

          {layout.nowLine ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
              style={{ top: `${layout.nowLine.topPct}%` }}
            >
              <span className="flex w-14 shrink-0 -translate-y-1/2 justify-center">
                <span className="rounded-md bg-primary px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-primary-ink">
                  {layout.nowLine.label}
                </span>
              </span>
              <span className="-translate-y-1/2 flex-1 border-t border-dashed border-primary" />
            </div>
          ) : null}

          {layout.blocks.length === 0 ? (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 z-10 mx-auto w-fit rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-muted shadow-card">
              No appointments this week
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
