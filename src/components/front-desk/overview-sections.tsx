import Link from "next/link";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Avatar, KpiCard } from "@/components/ui/card";
import { EmptyState, ListRow, ListRows } from "@/components/ui/data";
import { initialsOf } from "@/components/ui/rail";
import { formatManilaShortDate, formatManilaTime } from "@/lib/appointments/format";
import type { RecentAppointment, TodaySummary } from "@/lib/front-desk/overview";
import { formatRequestId, formatWaiting, type RequestQueueItem } from "@/lib/front-desk/requests";
import type { ScheduleItem } from "@/lib/front-desk/schedule";

/** Overview widgets (SPEC-frontdesk §4, redesign 2026-11-08). */

const ROW_LINK = "focus-ring rounded-sm text-sm font-medium text-ink underline-offset-4 hover:underline";

/** The four summary cards. Pending comes first because it needs staff action. */
export function OverviewCards({
  pending,
  overduePending,
  overdueMayBeMore = false,
  today,
}: {
  pending: number;
  /** Pending requests that have waited a full day or more. */
  overduePending: number;
  /** The overdue count comes from a capped preview, so more may be waiting. */
  overdueMayBeMore?: boolean;
  today: TodaySummary;
}) {
  const overdueLabel = `${overduePending}${overdueMayBeMore ? "+" : ""} waiting over 24 h`;
  return (
    <ul aria-label="Summary" className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
      <li>
        <KpiCard
          label="Pending confirmation"
          value={pending}
          detail={overduePending > 0 ? overdueLabel : "None waiting over 24 h"}
          detailTone={overduePending > 0 ? "danger" : "muted"}
        />
      </li>
      <li>
        <KpiCard
          label="Today's appointments"
          value={today.total}
          detail={`${today.confirmed} confirmed · ${today.pending} pending`}
        />
      </li>
      <li>
        <KpiCard
          label="Checked in"
          value={today.checkedIn}
          detail={today.nextCheckIn ? `Next: ${formatManilaTime(today.nextCheckIn)}` : "No more confirmed visits today"}
        />
      </li>
      <li>
        <KpiCard label="Completed today" value={today.completed} detail={`${today.noShow} no-show`} />
      </li>
    </ul>
  );
}

/** Pending requests, oldest first, each with how long it has waited. */
export function PendingRequestsList({ items, now }: { items: RequestQueueItem[]; now: Date }) {
  if (items.length === 0) {
    return <EmptyState>No requests are waiting for review.</EmptyState>;
  }
  return (
    <ListRows>
      {items.map((item) => {
        const waiting = formatWaiting(item.createdAt, now);
        return (
          <ListRow key={item.id} className="flex-wrap">
            <Avatar initials={initialsOf(item.patientName, "PT")} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{item.patientName}</p>
              <p className="truncate text-xs text-ink-muted">
                {`${item.doctorName} · ${formatManilaShortDate(item.scheduledAt)} · ${formatManilaTime(item.scheduledAt)}`}
              </p>
            </div>
            <Badge tone={waiting.overdue ? "danger" : "warning"}>{`Waiting ${waiting.label}`}</Badge>
            <LinkButton
              variant="outline"
              size="sm"
              href={`/front-desk/requests/${item.id}`}
              aria-label={`Review request ${formatRequestId(item.id)} from ${item.patientName}`}
            >
              Review
            </LinkButton>
          </ListRow>
        );
      })}
    </ListRows>
  );
}

/** Today's appointments in time order with their status. */
export function TodayScheduleList({ items }: { items: ScheduleItem[] }) {
  if (items.length === 0) {
    return <EmptyState>No appointments are scheduled today.</EmptyState>;
  }
  return (
    <ListRows>
      {items.map((item) => (
        <ListRow key={item.id}>
          <span className="w-18 shrink-0 text-sm font-medium tabular-nums text-ink">
            {formatManilaTime(item.scheduledAt)}
          </span>
          <div className="min-w-0 flex-1">
            <Link href={`/front-desk/requests/${item.id}`} className={`${ROW_LINK} block truncate font-normal`}>
              {item.patientName}
            </Link>
            <p className="truncate text-xs text-ink-muted">{item.doctorName}</p>
          </div>
          <StatusBadge status={item.status} />
        </ListRow>
      ))}
    </ListRows>
  );
}

const ACTIVITY_VERB: Partial<Record<RecentAppointment["status"], string>> = {
  confirmed: "confirmed",
  rejected: "rejected",
  cancelled: "cancelled",
};

/** Recently confirmed, rejected, and cancelled appointments in one feed. */
export function RecentActivityFeed({ items }: { items: RecentAppointment[] }) {
  if (items.length === 0) {
    return <EmptyState>No recent confirmations, rejections, or cancellations.</EmptyState>;
  }
  return (
    <ul aria-label="Recent activity" className="flex flex-col divide-y divide-line">
      {items.map((item) => (
        <li key={`${item.id}-${item.status}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <time dateTime={item.changedAt} className="w-28 shrink-0 text-xs tabular-nums text-ink-muted">
            {`${formatManilaShortDate(item.changedAt)}, ${formatManilaTime(item.changedAt)}`}
          </time>
          <p className="min-w-0 flex-1 text-sm text-ink">
            <Link href={`/front-desk/requests/${item.id}`} className={ROW_LINK}>
              {item.patientName}
            </Link>
            {` ${ACTIVITY_VERB[item.status] ?? item.status} with ${item.doctorName} for ${formatManilaShortDate(item.scheduledAt)}, ${formatManilaTime(item.scheduledAt)}`}
            {item.reason ? <span className="text-ink-secondary">{` · Reason: ${item.reason}`}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
