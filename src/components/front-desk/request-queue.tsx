import clsx from "clsx";
import Link from "next/link";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { todayInManila } from "@/lib/appointments/filters";
import {
  formatManilaDateTime,
  formatManilaMediumDate,
  formatManilaTime,
} from "@/lib/appointments/format";
import {
  REQUEST_QUEUE_LIMIT,
  formatRequestId,
  type RequestQueueItem,
} from "@/lib/front-desk/requests";

import { EmptyState } from "./empty-state";
import { CELL, HEADER_CELL, ROW, TableFrame } from "./table-frame";


/**
 * The request queue (SPEC-frontdesk §5). A single table keeps the reading
 * order identical at every width; below `lg` it scrolls inside its own frame
 * so the page itself never scrolls sideways.
 */
export function RequestQueue({
  items,
  limitReached,
}: {
  items: RequestQueueItem[];
  limitReached: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState>No requests match these filters.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        {items.length === 1 ? "1 request" : `${items.length} requests`}
      </p>
      <TableFrame label="Appointment requests" minWidthClass="min-w-[56rem]">
        <thead>
          <tr>
            <th scope="col" className={HEADER_CELL}>Request</th>
            <th scope="col" className={HEADER_CELL}>Patient</th>
            <th scope="col" className={HEADER_CELL}>Specialty</th>
            <th scope="col" className={HEADER_CELL}>Doctor</th>
            <th scope="col" className={HEADER_CELL}>Requested for</th>
            <th scope="col" className={HEADER_CELL}>Submitted</th>
            <th scope="col" className={HEADER_CELL}>Status</th>
            <th scope="col" className={HEADER_CELL}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const shortId = formatRequestId(item.id);
            // todayInManila gives the Manila calendar date of any instant.
            const manilaDate = todayInManila(new Date(item.scheduledAt));
            return (
              <tr key={item.id} className={ROW}>
                <td className={clsx(CELL, "font-mono text-xs text-ink-secondary")}>
                  {shortId}
                </td>
                <td className={CELL}>
                  <div className="font-medium">{item.patientName}</div>
                  <div className="text-xs text-ink-secondary">
                    {item.patientEmail ?? "Email not provided"}
                  </div>
                  <div className="text-xs text-ink-secondary">
                    {item.patientPhone ?? "Phone not provided"}
                  </div>
                </td>
                <td className={CELL}>
                  {item.specialtyNames.length > 0
                    ? item.specialtyNames.join(", ")
                    : "Not specified"}
                </td>
                <td className={CELL}>{item.doctorName}</td>
                <td className={CELL}>
                  <div>{formatManilaMediumDate(manilaDate)}</div>
                  <div className="text-xs text-ink-secondary">
                    {formatManilaTime(item.scheduledAt)}
                  </div>
                </td>
                <td className={clsx(CELL, "text-ink-secondary")}>
                  {formatManilaDateTime(item.createdAt)}
                </td>
                <td className={CELL}>
                  <AppointmentStatusBadge status={item.status} />
                </td>
                <td className={clsx(CELL, "text-right")}>
                  <Link
                    href={`/front-desk/requests/${item.id}`}
                    aria-label={`View request ${shortId}`}
                    className="focus-ring inline-flex min-h-11 items-center rounded-lg px-2 font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableFrame>
      {limitReached ? (
        <p className="text-sm text-ink-secondary">Showing the first {REQUEST_QUEUE_LIMIT} requests. Narrow the filters to
          see more.</p>
      ) : null}
    </div>
  );
}
