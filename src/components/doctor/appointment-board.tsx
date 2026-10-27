import Link from "next/link";

import type { AppointmentStatus } from "@/lib/appointments/status";
import type {
  AppointmentHistoryEntry,
  DoctorAppointment,
} from "@/lib/appointments/types";

import type { AppointmentHistoryItem } from "./appointment-actions";
import { AppointmentCard } from "./appointment-card";
import { toHistoryItems } from "./history-items";

type BoardColumn = {
  status: AppointmentStatus;
  title: string;
  dotClass: string;
};

const BOARD_COLUMNS: BoardColumn[] = [
  { status: "requested", title: "Pending", dotClass: "bg-warning" },
  { status: "confirmed", title: "Confirmed", dotClass: "bg-primary" },
  { status: "completed", title: "Completed", dotClass: "bg-success" },
  { status: "cancelled", title: "Cancelled", dotClass: "bg-danger" },
  { status: "no_show", title: "No-show", dotClass: "bg-ink-muted" },
];

/**
 * Kanban board with one column per appointment status. Columns scroll
 * horizontally on narrow viewports inside a labelled, focusable region.
 */
export function AppointmentBoard({
  appointments,
  historyMap,
  scheduleHint,
  resetHref = "/doctor",
}: {
  appointments: DoctorAppointment[];
  historyMap: Map<string, AppointmentHistoryEntry[]>;
  scheduleHint: string;
  resetHref?: string;
}) {
  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-surface px-4 py-10 sm:px-6">
        <h2 className="text-lg font-semibold text-ink">
          No appointments for this period
        </h2>
        <p className="max-w-prose text-sm leading-6 text-ink-secondary">
          Try another period or status. Only appointments assigned to you are
          shown.
        </p>
        <Link
          href={resetHref}
          className="rounded-lg text-sm font-medium text-primary underline underline-offset-4 focus-ring hover:text-primary-hover"
        >
          Reset filters
        </Link>
      </div>
    );
  }

  const byStatus = new Map<AppointmentStatus, DoctorAppointment[]>();
  for (const appointment of appointments) {
    const list = byStatus.get(appointment.status) ?? [];
    list.push(appointment);
    byStatus.set(appointment.status, list);
  }

  return (
    <div
      role="region"
      aria-label="Appointments board, grouped by status"
      tabIndex={0}
      className="flex gap-4 overflow-x-auto pb-4 focus-ring"
    >
      {BOARD_COLUMNS.map((column) => {
        const cards = byStatus.get(column.status) ?? [];
        return (
          <section
            key={column.status}
            aria-labelledby={`board-column-${column.status}`}
            className="flex w-72 shrink-0 flex-col rounded-xl border border-line bg-surface-muted p-3"
          >
            <div className="flex items-center gap-2 px-1 pb-3">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${column.dotClass}`}
              />
              <h2
                id={`board-column-${column.status}`}
                className="text-sm font-semibold text-ink"
              >
                {column.title}
              </h2>
              <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold tabular-nums text-ink-secondary">
                {cards.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {cards.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">
                  No appointments
                </p>
              ) : (
                cards.map((appointment) => {
                  const history: AppointmentHistoryItem[] = toHistoryItems(
                    historyMap.get(appointment.id),
                  );
                  return (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      history={history}
                      scheduleHint={scheduleHint}
                    />
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
