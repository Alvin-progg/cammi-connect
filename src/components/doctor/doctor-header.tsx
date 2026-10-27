import Link from "next/link";

import {
  APPOINTMENT_RANGE_LABELS,
  DOCTOR_VIEW_LABELS,
  type AppointmentRange,
  type DoctorView,
} from "@/lib/appointments/dashboard";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/lib/appointments/status";

import { PlusIcon } from "./icons";

const VIEW_ORDER: DoctorView[] = [
  "board",
  "list",
  "calendar",
  "stats",
  "notifications",
  "profile",
];

const RANGE_ORDER: AppointmentRange[] = ["today", "upcoming", "history"];

function viewHref(view: DoctorView): string {
  return `/doctor?view=${view}`;
}

function rangeHref(range: AppointmentRange, status: AppointmentStatus | null) {
  const params = new URLSearchParams({ view: "board", range });
  if (status) {
    params.set("status", status);
  }
  return `/doctor?${params.toString()}`;
}

/**
 * Workspace header: breadcrumb, page title, doctor-scope pill, view tabs, and
 * the appointment filter bar (board/list views only).
 */
export function DoctorHeader({
  view,
  doctorName,
  departmentName,
  todayLabel,
  range,
  status,
  date,
}: {
  view: DoctorView;
  doctorName: string;
  departmentName: string | null;
  todayLabel: string;
  range?: AppointmentRange;
  status?: AppointmentStatus | null;
  date?: string;
}) {
  const showAppointmentFilters = view === "board" || view === "list";

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
            <span>Doctor</span>
            <span aria-hidden="true"> / </span>
            <span className="font-medium text-ink">
              {DOCTOR_VIEW_LABELS[view]}
            </span>
          </nav>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-ink-muted sm:block">
              {todayLabel} · PHT
            </p>
            <Link
              href="/doctor?view=calendar"
              className="focus-ring inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-3 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover motion-reduce:transition-none"
            >
              <PlusIcon className="size-4" />
              Block time
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-ink text-balance">
            {view === "board" || view === "list"
              ? `${doctorName} — schedule`
              : DOCTOR_VIEW_LABELS[view]}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
            {departmentName ?? "Doctor scope"}
          </span>
        </div>

        <div
          className={`flex flex-wrap items-end justify-between gap-3 ${
            showAppointmentFilters ? "" : "pb-0"
          }`}
        >
          <div
            role="tablist"
            aria-label="Dashboard views"
            className="flex flex-wrap items-center gap-1"
          >
            {VIEW_ORDER.map((item) => {
              const active = item === view;
              return (
                <Link
                  key={item}
                  role="tab"
                  aria-selected={active}
                  href={viewHref(item)}
                  className={`focus-ring -mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-ink-secondary hover:text-ink"
                  }`}
                >
                  {DOCTOR_VIEW_LABELS[item]}
                </Link>
              );
            })}
          </div>

          {showAppointmentFilters ? (
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <div
                role="group"
                aria-label="Appointment period"
                className="flex items-center gap-1 rounded-lg border border-line bg-surface-muted p-1"
              >
                {RANGE_ORDER.map((item) => {
                  const active = item === range;
                  return (
                    <Link
                      key={item}
                      href={rangeHref(item, status ?? null)}
                      aria-current={active ? "true" : undefined}
                      className={`focus-ring rounded-md px-3 py-1.5 text-sm font-medium ${
                        active
                          ? "bg-surface text-primary shadow-card"
                          : "text-ink-secondary hover:text-ink"
                      }`}
                    >
                      {APPOINTMENT_RANGE_LABELS[item]}
                    </Link>
                  );
                })}
              </div>

              <form
                method="get"
                action="/doctor"
                className="flex flex-wrap items-center gap-2"
              >
                <input type="hidden" name="view" value={view} />
                <label htmlFor="filter-date" className="sr-only">
                  Specific date
                </label>
                <input
                  id="filter-date"
                  name="date"
                  type="date"
                  defaultValue={range === "day" ? date : undefined}
                  className="min-h-9 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring"
                />
                <label htmlFor="filter-status" className="sr-only">
                  Status
                </label>
                <select
                  id="filter-status"
                  name="status"
                  defaultValue={status ?? "all"}
                  className="min-h-9 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring"
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
                  className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-primary transition-colors hover:bg-primary-soft motion-reduce:transition-none"
                >
                  Apply
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
