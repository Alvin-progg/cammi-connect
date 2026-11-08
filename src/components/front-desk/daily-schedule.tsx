import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { formatManilaTime } from "@/lib/appointments/format";
import { BOOKING_SOURCE_LABELS, formatRequestId } from "@/lib/front-desk/requests";
import {
  SCHEDULE_LIMIT,
  allowedAttendanceActions,
  type ScheduleItem,
} from "@/lib/front-desk/schedule";

import { AttendanceActions } from "./attendance-actions";
import { EmptyState, Table, Td, Th, Tr } from "@/components/ui/data";

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
      <EmptyState>No appointments match these filters.</EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        {items.length === 1 ? "1 appointment" : `${items.length} appointments`}
      </p>
      <Table label="Daily schedule" minWidthClass="min-w-[52rem]">
        <thead>
          <tr>
            <Th>Time</Th>
            <Th>Patient</Th>
            <Th>Doctor</Th>
            <Th>Status</Th>
            <Th>Attendance</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const actions = allowedAttendanceActions(item.status, item.scheduledAt, now);
            return (
              <Tr key={item.id}>
                <Td className="whitespace-nowrap tabular-nums">
                  <div className="font-medium">{formatManilaTime(item.scheduledAt)}</div>
                  <div className="text-xs text-ink-secondary">{`${item.durationMinutes} minutes`}</div>
                </Td>
                <Td>
                  <Link
                    href={`/front-desk/requests/${item.id}`}
                    className="focus-ring rounded-sm font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {item.patientName}
                  </Link>
                  <p className="font-mono text-xs text-ink-muted">{formatRequestId(item.id)}</p>
                </Td>
                <Td>
                  <div className="text-ink-secondary">{item.doctorName}</div>
                  <div className="text-xs text-ink-muted">
                    {item.specialtyNames.length > 0 ? item.specialtyNames.join(", ") : "Not specified"}
                  </div>
                </Td>
                <Td>
                  <StatusBadge status={item.status} />
                  <p className="mt-1 text-xs text-ink-muted">{BOOKING_SOURCE_LABELS[item.bookingSource]}</p>
                </Td>
                <Td>
                  {actions.length > 0 ? (
                    <AttendanceActions
                      appointmentId={item.id}
                      patientName={item.patientName}
                      actions={actions}
                    />
                  ) : (
                    <span className="text-xs text-ink-muted">
                      {item.status === "requested" ? "Confirm first" : "—"}
                    </span>
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {limitReached ? (
        <p className="text-sm text-ink-secondary">
          {`Showing the first ${SCHEDULE_LIMIT} appointments. Narrow the filters to see more.`}
        </p>
      ) : null}
    </div>
  );
}
