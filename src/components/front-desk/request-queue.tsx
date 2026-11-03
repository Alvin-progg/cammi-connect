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

const HEADER_CELL = "px-4 py-3 text-left text-xs font-medium text-ink-muted";
const CELL = "px-4 py-3 align-top text-sm text-ink";

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
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
        No requests match these filters.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table aria-label="Appointment requests" className="w-full min-w-[56rem]">
          <thead className="border-b border-line bg-surface-muted">
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
          <tbody className="divide-y divide-line">
            {items.map((item) => {
              const shortId = formatRequestId(item.id);
              // todayInManila gives the Manila calendar date of any instant.
              const manilaDate = todayInManila(new Date(item.scheduledAt));
              return (
                <tr key={item.id}>
                  <td className={`${CELL} font-mono text-xs text-ink-secondary`}>
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
                  <td className={`${CELL} text-ink-secondary`}>
                    {formatManilaDateTime(item.createdAt)}
                  </td>
                  <td className={CELL}>
                    <AppointmentStatusBadge status={item.status} />
                  </td>
                  <td className={`${CELL} text-right`}>
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
        </table>
      </div>
      {limitReached ? (
        <p className="text-sm text-ink-secondary">Showing the first {REQUEST_QUEUE_LIMIT} requests. Narrow the filters to
          see more.</p>
      ) : null}
    </div>
  );
}
