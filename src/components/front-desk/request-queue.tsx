import Link from "next/link";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState, Table, Td, Th, Tr } from "@/components/ui/data";
import { todayInManila } from "@/lib/appointments/filters";
import {
  formatManilaMediumDate,
  formatManilaShortDate,
  formatManilaTime,
} from "@/lib/appointments/format";
import { cn } from "@/lib/cn";
import {
  REQUEST_QUEUE_LIMIT,
  formatRequestId,
  formatWaiting,
  groupRequestBoard,
  type RequestBoardColumn,
  type RequestQueueItem,
} from "@/lib/front-desk/requests";

function specialtyLabel(item: RequestQueueItem): string {
  return item.specialtyNames.length > 0 ? item.specialtyNames.join(", ") : "Not specified";
}

function LimitNote({ limitReached }: { limitReached: boolean }) {
  return limitReached ? (
    <p className="text-sm text-ink-secondary">
      {`Showing the first ${REQUEST_QUEUE_LIMIT} requests. Narrow the filters to see more.`}
    </p>
  ) : null;
}

/**
 * The request queue as a table (SPEC-frontdesk §5). It scrolls inside its own
 * frame below `lg` so the page never scrolls sideways.
 */
export function RequestQueue({
  items,
  limitReached,
  now = new Date(),
}: {
  items: RequestQueueItem[];
  limitReached: boolean;
  /** The moment pending waits are measured from. */
  now?: Date;
}) {
  if (items.length === 0) {
    return <EmptyState>No requests match these filters.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-secondary">
        {items.length === 1 ? "1 request" : `${items.length} requests`}
      </p>
      <Table label="Appointment requests" minWidthClass="min-w-[56rem]">
        <thead>
          <tr>
            <Th>Requested for</Th>
            <Th>Patient</Th>
            <Th>Doctor</Th>
            <Th>Waiting</Th>
            <Th>Status</Th>
            <Th>Request</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Tr key={item.id}>
              <Td className="whitespace-nowrap tabular-nums">
                {/* todayInManila gives the Manila calendar date of any instant. */}
                <div>{formatManilaMediumDate(todayInManila(new Date(item.scheduledAt)))}</div>
                <div className="text-xs text-ink-secondary">{formatManilaTime(item.scheduledAt)}</div>
              </Td>
              <Td>
                <Link
                  href={`/front-desk/requests/${item.id}`}
                  className="focus-ring rounded-sm font-medium text-ink underline-offset-4 hover:underline"
                >
                  {item.patientName}
                </Link>
                <div className="text-xs text-ink-secondary">{item.patientEmail ?? "Email not provided"}</div>
                <div className="text-xs text-ink-secondary">{item.patientPhone ?? "Phone not provided"}</div>
              </Td>
              <Td>
                <div>{item.doctorName}</div>
                <div className="text-xs text-ink-secondary">{specialtyLabel(item)}</div>
              </Td>
              <Td className="tabular-nums">
                {item.status === "requested" ? formatWaiting(item.createdAt, now).label : "—"}
              </Td>
              <Td>
                <StatusBadge status={item.status} />
              </Td>
              <Td className="font-mono text-xs text-ink-secondary">{formatRequestId(item.id)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <LimitNote limitReached={limitReached} />
    </div>
  );
}

const COLUMN_DOT: Record<RequestBoardColumn["key"], string> = {
  pending: "bg-warning",
  confirmed: "bg-primary",
  checked_in: "bg-success",
  closed: "bg-danger",
};

function RequestCard({ item, now }: { item: RequestQueueItem; now: Date }) {
  const waiting = item.status === "requested" ? formatWaiting(item.createdAt, now) : null;
  return (
    <Link
      href={`/front-desk/requests/${item.id}`}
      className="focus-ring flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-line-strong motion-reduce:transition-none"
    >
      <div className="flex justify-between gap-2">
        <p className="font-semibold text-ink">{item.patientName}</p>
        <span className="font-mono text-[11px] text-ink-muted">{formatRequestId(item.id)}</span>
      </div>
      <p className="text-[13px] text-ink-secondary">{`${item.doctorName} · ${specialtyLabel(item)}`}</p>
      <p className="text-[13px] tabular-nums text-ink">
        {`${formatManilaShortDate(item.scheduledAt)} · ${formatManilaTime(item.scheduledAt)}`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {/* The queue holds Cami requests only. */}
        <Badge tone="ai">Cami</Badge>
        {waiting ? (
          <Badge tone={waiting.overdue ? "danger" : "warning"}>{`Waiting ${waiting.label}`}</Badge>
        ) : (
          <StatusBadge status={item.status} />
        )}
      </div>
    </Link>
  );
}

/** The request queue as a board: one column per status group. */
export function RequestBoard({
  items,
  limitReached = false,
  now = new Date(),
}: {
  items: RequestQueueItem[];
  limitReached?: boolean;
  now?: Date;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1000px] grid-cols-4 gap-4">
          {groupRequestBoard(items).map((column) => (
            <section
              key={column.key}
              aria-labelledby={`board-${column.key}`}
              className="flex flex-col gap-2.5 rounded-xl bg-surface-muted p-3"
            >
              <div className="flex items-center justify-between px-1">
                <h2 id={`board-${column.key}`} className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden="true" className={cn("size-2 rounded-full", COLUMN_DOT[column.key])} />
                  {column.title}
                </h2>
                <span className="text-xs tabular-nums text-ink-secondary">{column.items.length}</span>
              </div>
              {column.items.length === 0 ? (
                <p className="px-1 py-2 text-xs text-ink-muted">No requests</p>
              ) : (
                column.items.map((item) => <RequestCard key={item.id} item={item} now={now} />)
              )}
            </section>
          ))}
        </div>
      </div>
      <LimitNote limitReached={limitReached} />
    </div>
  );
}
