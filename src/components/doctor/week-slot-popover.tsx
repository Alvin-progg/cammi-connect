"use client";

import { useEffect, useRef } from "react";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { formatManilaShortDate } from "@/lib/appointments/format";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { WeekBlock } from "@/lib/appointments/week";

import {
  AppointmentActions,
  type AppointmentHistoryItem,
} from "./appointment-actions";
import { CloseIcon } from "./icons";
import { patientInitials } from "./slot-tones";

/** Blocks in the lower part of the grid open their popover upward. */
const OPEN_UPWARD_FROM_PCT = 55;

/**
 * Non-modal detail popover anchored beside a week-grid block: it opens toward
 * the free side of the week and scales in from the block it belongs to. On
 * phones it becomes a bottom sheet. Escape and outside clicks close it, except
 * while the nested "Manage" modal dialog is open.
 */
export function WeekSlotPopover({
  id,
  block,
  timeRange,
  history,
  scheduleHint,
  onClose,
}: {
  id: string;
  block: WeekBlock;
  timeRange: string;
  history: AppointmentHistoryItem[];
  scheduleHint: string;
  onClose: (options: { restoreFocus: boolean }) => void;
}) {
  const { appointment } = block;
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = `${id}-title`;

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const hasOpenModal = () =>
      popoverRef.current?.querySelector("dialog[open]") !== null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !hasOpenModal()) {
        onClose({ restoreFocus: true });
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const anchor = popoverRef.current?.parentElement;
      if (!hasOpenModal() && anchor && !anchor.contains(target)) {
        onClose({ restoreFocus: false });
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  const opensRight = block.dayIndex <= 3;
  const opensUp = block.topPct > OPEN_UPWARD_FROM_PCT;
  const placement = [
    opensRight ? "sm:left-[calc(100%+0.25rem)]" : "sm:right-[calc(100%+0.25rem)]",
    opensUp ? "sm:bottom-0" : "sm:top-0",
    opensRight
      ? opensUp
        ? "sm:origin-bottom-left"
        : "sm:origin-top-left"
      : opensUp
        ? "sm:origin-bottom-right"
        : "sm:origin-top-right",
  ].join(" ");

  return (
    <div
      ref={popoverRef}
      id={id}
      role="dialog"
      aria-labelledby={titleId}
      className={`fixed inset-x-3 bottom-3 z-40 origin-bottom rounded-2xl border border-line bg-surface p-4 text-left shadow-overlay transition-[opacity,transform] duration-150 ease-snappy starting:scale-[0.97] starting:opacity-0 motion-reduce:starting:scale-100 sm:absolute sm:inset-x-auto sm:bottom-auto sm:w-80 ${placement}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
        >
          {patientInitials(appointment.patientName)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="truncate text-base font-semibold text-ink">
            {appointment.patientName}
          </h3>
          <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
            {formatManilaShortDate(appointment.scheduledAt)} · {timeRange}
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close details"
          onClick={() => onClose({ restoreFocus: true })}
          className="focus-ring -mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-[color,background-color,transform] duration-150 ease-snappy hover:bg-surface-muted hover:text-ink active:scale-[0.97] motion-reduce:transition-none"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
        <div className="col-span-2">
          <dt className="text-xs text-ink-muted">Reason</dt>
          <dd className="mt-0.5 text-ink">
            {appointment.reason ?? "General consultation"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Status</dt>
          <dd className="mt-1">
            <AppointmentStatusBadge status={appointment.status} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Duration</dt>
          <dd className="mt-0.5 tabular-nums text-ink">
            {appointment.durationMinutes} min
          </dd>
        </div>
      </dl>

      {history.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-xs text-ink-muted">Status history</h4>
          <ol className="mt-2 flex flex-col gap-2.5 rounded-xl border border-line bg-surface-muted p-3">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 text-xs">
                <span className="w-24 shrink-0 tabular-nums text-ink-muted">
                  {entry.createdAtLabel}
                </span>
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full border-2 border-primary bg-surface"
                />
                <span className="min-w-0 truncate font-medium text-ink">
                  {APPOINTMENT_STATUS_LABELS[entry.toStatus]}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-4 border-t border-line pt-4">
        <AppointmentActions
          appointmentId={appointment.id}
          status={appointment.status}
          patientName={appointment.patientName}
          scheduledAtLabel={`${formatManilaShortDate(appointment.scheduledAt)} · ${timeRange}`}
          scheduleHint={scheduleHint}
          history={history}
        />
      </div>
    </div>
  );
}
