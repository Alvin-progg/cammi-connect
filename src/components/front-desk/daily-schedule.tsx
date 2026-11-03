import Link from "next/link";

import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { formatManilaTime } from "@/lib/appointments/format";
import { BOOKING_SOURCE_LABELS, formatRequestId } from "@/lib/front-desk/requests";
import {
  SCHEDULE_LIMIT,
  allowedAttendanceActions,
  type ScheduleItem,
} from "@/lib/front-desk/schedule";

import { AttendanceActions } from "./attendance-actions";

const HEADER_CELL = "px-4 py-3 text-left text-xs font-medium text-ink-muted";
const CELL = "px-4 py-3 align-top text-sm text-ink";

/**
 * One day's appointments from every booking source (SPEC-frontdesk §8), with
 * the attendance actions each row allows. Like the request queue, the table
 * scrolls inside its own frame below `lg`.
 */
export function DailySchedule({
  items,
  limitReached,
  now = new Date(),
}: {
  items: ScheduleItem[];
  limitReached: boolean;
  /** The moment used to decide which attendance actions are open. */
  now?: Date;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
        No appointments match these filters.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
        <table aria-label="Daily schedule" className="w-full min-w-[60rem]">
          <thead className="border-b border-line bg-surface-muted">
            <tr>
              <th scope="col" className={HEADER_CELL}>Time</th>
              <th scope="col" className={HEADER_CELL}>Patient</th>
              <th scope="col" className={HEADER_CELL}>Doctor</th>
              <th scope="col" className={HEADER_CELL}>Specialty</th>
              <th scope="col" className={HEADER_CELL}>Status</th>
              <th scope="col" className={HEADER_CELL}>Booked via</th>
              <th scope="col" className={HEADER_CELL}>Attendance</th>
              <th scope="col" className={HEADER_CELL}>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => {
              const shortId = formatRequestId(item.id);
              return (
                <tr key={item.id}>
                  <td className={CELL}>
                    <div className="font-medium">{formatManilaTime(item.scheduledAt)}</div>
                    <div className="text-xs text-ink-secondary">
                      {`${item.durationMinutes} minutes`}
                    </div>
                  </td>
                  <td className={`${CELL} font-medium`}>{item.patientName}</td>
                  <td className={CELL}>{item.doctorName}</td>
                  <td className={CELL}>
                    {item.specialtyNames.length > 0
                      ? item.specialtyNames.join(", ")
                      : "Not specified"}
                  </td>
                  <td className={CELL}>
                    <AppointmentStatusBadge status={item.status} />
                  </td>
                  <td className={CELL}>
                    <span className="inline-flex items-center rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-secondary">
                      {BOOKING_SOURCE_LABELS[item.bookingSource]}
                    </span>
                  </td>
                  <td className={CELL}>
                    <AttendanceActions
                      appointmentId={item.id}
                      patientName={item.patientName}
                      actions={allowedAttendanceActions(item.status, item.scheduledAt, now)}
                    />
                  </td>
                  <td className={`${CELL} text-right`}>
                    <Link
                      href={`/front-desk/requests/${item.id}`}
                      aria-label={`View appointment ${shortId}`}
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
        <p className="text-sm text-ink-secondary">
          {`Showing the first ${SCHEDULE_LIMIT} appointments. Narrow the filters to see more.`}
        </p>
      ) : null}
    </div>
  );
}
