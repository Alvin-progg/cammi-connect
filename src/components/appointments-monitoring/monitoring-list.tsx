import Link from "next/link";

import { EmptyState } from "@/components/admin/empty-state";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { CELL, HEADER_CELL, ROW, TableFrame } from "@/components/front-desk/table-frame";
import { buttonVariants } from "@/components/ui/button";
import { formatManilaDateTime } from "@/lib/appointments/format";
import {
  MONITORING_PATH,
  monitoringListHref,
  type AppointmentMonitoringFilters,
  type MonitoringListItem,
} from "@/lib/appointments/monitoring";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUSES,
  BOOKING_SOURCES,
} from "@/lib/appointments/status";
import { BOOKING_SOURCE_LABELS, formatRequestId } from "@/lib/front-desk/requests";

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const CONTROL_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const LINK_CLASS =
  "rounded font-mono text-xs font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline";

type FilterOption = { id: string; name: string };

/** GET form, so filters live in the URL: shareable and usable as dashboard deep links. */
export function MonitoringFilters({
  filters,
  doctors,
  departments,
}: {
  filters: AppointmentMonitoringFilters;
  doctors: FilterOption[];
  departments: FilterOption[];
}) {
  const selectedStatuses = new Set(filters.statuses);

  return (
    <form
      role="search"
      aria-label="Filter appointments"
      method="get"
      action={MONITORING_PATH}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1 sm:flex-none">
          <label htmlFor="monitoring-search" className={FIELD_LABEL_CLASS}>
            Patient name
          </label>
          <input
            id="monitoring-search"
            name="q"
            type="search"
            defaultValue={filters.search}
            maxLength={100}
            className={CONTROL_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="monitoring-doctor" className={FIELD_LABEL_CLASS}>
            Doctor
          </label>
          <select
            id="monitoring-doctor"
            name="doctor"
            defaultValue={filters.doctorId ?? ""}
            className={CONTROL_CLASS}
          >
            <option value="">All doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="monitoring-department" className={FIELD_LABEL_CLASS}>
            Department
          </label>
          <select
            id="monitoring-department"
            name="department"
            defaultValue={filters.departmentId ?? ""}
            className={CONTROL_CLASS}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="monitoring-source" className={FIELD_LABEL_CLASS}>
            Source
          </label>
          <select
            id="monitoring-source"
            name="source"
            defaultValue={filters.source ?? ""}
            className={CONTROL_CLASS}
          >
            <option value="">All sources</option>
            {BOOKING_SOURCES.map((source) => (
              <option key={source} value={source}>
                {BOOKING_SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="monitoring-from" className={FIELD_LABEL_CLASS}>
            From
          </label>
          <input
            id="monitoring-from"
            name="from"
            type="date"
            defaultValue={filters.from ?? ""}
            className={CONTROL_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="monitoring-to" className={FIELD_LABEL_CLASS}>
            To
          </label>
          <input
            id="monitoring-to"
            name="to"
            type="date"
            defaultValue={filters.to ?? ""}
            className={CONTROL_CLASS}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className={`${FIELD_LABEL_CLASS} mb-1`}>Status</legend>
          {APPOINTMENT_STATUSES.map((status) => (
            <label key={status} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={selectedStatuses.has(status)}
                className="size-4 accent-primary focus-ring"
              />
              {APPOINTMENT_STATUS_LABELS[status]}
            </label>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <Link href={MONITORING_PATH} className={buttonVariants({ variant: "ghost" })}>
            Clear
          </Link>
          <button type="submit" className={buttonVariants({ variant: "secondary" })}>
            Filter
          </button>
        </div>
      </div>
    </form>
  );
}

export function MonitoringTable({
  items,
  total,
  page,
  pageCount,
  filters,
}: {
  items: MonitoringListItem[];
  total: number;
  page: number;
  pageCount: number;
  filters: AppointmentMonitoringFilters;
}) {
  if (items.length === 0) {
    return <EmptyState>No appointments match these filters.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        {total === 1 ? "1 appointment" : `${total} appointments`}
      </p>
      <TableFrame label="Appointments" minWidthClass="min-w-[72rem]">
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL}>ID</th>
            <th scope="col" className={HEADER_CELL}>Patient</th>
            <th scope="col" className={HEADER_CELL}>Doctor</th>
            <th scope="col" className={HEADER_CELL}>Department / specialty</th>
            <th scope="col" className={HEADER_CELL}>Scheduled</th>
            <th scope="col" className={HEADER_CELL}>Status</th>
            <th scope="col" className={HEADER_CELL}>Source</th>
            <th scope="col" className={HEADER_CELL}>Created by</th>
            <th scope="col" className={HEADER_CELL}>Confirmed by</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={ROW}>
              <td className={CELL}>
                <Link href={`${MONITORING_PATH}/${item.id}`} className={LINK_CLASS}>
                  {formatRequestId(item.id)}
                </Link>
              </td>
              <td className={CELL}>
                <span className="block">{item.patientName}</span>
                <span className="block font-mono text-xs text-ink-muted">
                  {formatRequestId(item.patientId)}
                </span>
              </td>
              <td className={CELL}>{item.doctorName}</td>
              <td className={CELL}>
                <span className="block">{item.departmentName ?? "No department"}</span>
                {item.specialtyName ? (
                  <span className="block text-xs text-ink-secondary">{item.specialtyName}</span>
                ) : null}
              </td>
              <td className={CELL}>{formatManilaDateTime(item.scheduledAt)}</td>
              <td className={CELL}>
                <AppointmentStatusBadge status={item.status} />
              </td>
              <td className={CELL}>{BOOKING_SOURCE_LABELS[item.bookingSource]}</td>
              <td className={CELL}>{item.createdByName ?? "Unknown"}</td>
              <td className={CELL}>{item.confirmedByName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </TableFrame>
      <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-secondary">{`Page ${page} of ${pageCount}`}</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={monitoringListHref(filters, page - 1)}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Previous page
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              href={monitoringListHref(filters, page + 1)}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Next page
            </Link>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
