import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { formatManilaDateTime, formatManilaTime } from "@/lib/appointments/format";
import type { AppointmentSearchItem, RecentAppointment } from "@/lib/front-desk/overview";
import {
  BOOKING_SOURCE_LABELS,
  formatRequestId,
  type RequestQueueItem,
} from "@/lib/front-desk/requests";
import type { ScheduleItem } from "@/lib/front-desk/schedule";

import { EmptyState } from "./empty-state";
import { CELL, HEADER_CELL, ROW, TableFrame } from "./table-frame";

/** Overview lists (SPEC-frontdesk §4). Each links to the full view for more. */

const LIST_CLASS = "divide-y divide-line rounded-xl border border-line bg-surface shadow-card";
const MORE_LINK_CLASS =
  "focus-ring inline-flex min-h-11 items-center self-start rounded-lg text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline";
const DETAILS_LINK_CLASS =
  "focus-ring inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline";

function DetailsLink({ id, stretched = false }: { id: string; stretched?: boolean }) {
  const shortId = formatRequestId(id);
  return (
    <Link
      href={`/front-desk/requests/${id}`}
      aria-label={`View appointment ${shortId}`}
      className={clsx(
        DETAILS_LINK_CLASS,
        // Stretches the link's hit area over its whole list row, so the row is
        // clickable without nesting interactive elements.
        stretched && "after:absolute after:inset-0 after:rounded-[inherit]",
      )}
    >
      View
    </Link>
  );
}

function Row({ children, id }: { children: ReactNode; id: string }) {
  return (
    <li className="relative flex items-start justify-between gap-3 px-4 py-3 transition-colors duration-150 ease-snappy first:rounded-t-xl last:rounded-b-xl hover:bg-surface-muted motion-reduce:transition-none">
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
      <DetailsLink id={id} stretched />
    </li>
  );
}

export function PendingRequestsList({
  items,
  total,
}: {
  items: RequestQueueItem[];
  total: number;
}) {
  if (items.length === 0) {
    return <EmptyState>No requests are waiting for review.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Pending requests" className={LIST_CLASS}>
        {items.map((item) => (
          <Row key={item.id} id={item.id}>
            <span className="text-sm font-medium text-ink">{item.patientName}</span>
            <span className="text-sm text-ink-secondary">
              {`${formatManilaDateTime(item.scheduledAt)} · ${item.doctorName}`}
            </span>
          </Row>
        ))}
      </ul>
      <Link href="/front-desk/requests" className={MORE_LINK_CLASS}>
        {`View all ${total} pending`}
      </Link>
    </div>
  );
}

export function TodayScheduleList({
  items,
  total,
}: {
  items: ScheduleItem[];
  total: number;
}) {
  if (items.length === 0) {
    return <EmptyState>No appointments are scheduled today.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label="Today's schedule" className={LIST_CLASS}>
        {items.map((item) => (
          <Row key={item.id} id={item.id}>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium tabular-nums text-ink">
                {formatManilaTime(item.scheduledAt)}
              </span>
              <AppointmentStatusBadge status={item.status} />
            </span>
            <span className="text-sm text-ink">{item.patientName}</span>
            <span className="text-sm text-ink-secondary">{item.doctorName}</span>
          </Row>
        ))}
      </ul>
      <Link href="/front-desk/schedule" className={MORE_LINK_CLASS}>
        {`View all ${total} today`}
      </Link>
    </div>
  );
}

export function RecentActivityList({
  label,
  items,
  emptyMessage,
}: {
  label: string;
  items: RecentAppointment[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }
  return (
    <ul aria-label={label} className={LIST_CLASS}>
      {items.map((item) => (
        <Row key={item.id} id={item.id}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{item.patientName}</span>
            <AppointmentStatusBadge status={item.status} />
          </span>
          <span className="text-sm text-ink-secondary">
            {`${formatManilaDateTime(item.scheduledAt)} · ${item.doctorName}`}
          </span>
          {item.reason ? (
            <span className="text-sm text-ink-secondary">{`Reason: ${item.reason}`}</span>
          ) : null}
          <span className="text-xs text-ink-muted">
            {`Updated ${formatManilaDateTime(item.changedAt)}`}
          </span>
        </Row>
      ))}
    </ul>
  );
}


export function AppointmentSearchResults({
  query,
  result,
}: {
  query: string;
  result: { ok: true; items: AppointmentSearchItem[] } | { ok: false; message: string };
}) {
  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-danger-soft-ink">
        {result.message}
      </p>
    );
  }
  if (result.items.length === 0) {
    return <EmptyState>{`No appointments match “${query}”.`}</EmptyState>;
  }
  return (
    <TableFrame label={`Search results for “${query}”`} minWidthClass="min-w-[48rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Appointment</th>
          <th scope="col" className={HEADER_CELL}>Patient</th>
          <th scope="col" className={HEADER_CELL}>Doctor</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
          <th scope="col" className={HEADER_CELL}>Booked via</th>
          <th scope="col" className={HEADER_CELL}>
            <span className="sr-only">Details</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {result.items.map((item) => (
          <tr key={item.id} className={ROW}>
            <td className={CELL}>{formatManilaDateTime(item.scheduledAt)}</td>
            <td className={CELL}>
              <div className="font-medium">{item.patientName}</div>
              {item.patientPhone ? (
                <div className="text-xs text-ink-secondary">{item.patientPhone}</div>
              ) : null}
            </td>
            <td className={CELL}>{item.doctorName}</td>
            <td className={CELL}>
              <AppointmentStatusBadge status={item.status} />
            </td>
            <td className={CELL}>{BOOKING_SOURCE_LABELS[item.bookingSource]}</td>
            <td className={clsx(CELL, "text-right")}>
              <DetailsLink id={item.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
