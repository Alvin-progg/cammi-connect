import Link from "next/link";

import type { DashboardFilters } from "@/lib/admin/dashboard";
import { formatTrend } from "@/lib/analytics/display";
import type { DashboardCards } from "@/lib/analytics/metrics";
import { monitoringListHref } from "@/lib/appointments/monitoring";
import type { AppointmentStatus } from "@/lib/appointments/status";

type Card = {
  label: string;
  value: number;
  /** The date basis of the count (D4). */
  basis: string;
  status: AppointmentStatus | null;
  /** Pending and Cancelled are not scheduled-date counts, so their links drop the date range. */
  withDates: boolean;
  note?: string;
};

function cardHref(filters: DashboardFilters, card: Card): string {
  return monitoringListHref({
    search: "",
    doctorId: filters.doctorId,
    departmentId: filters.departmentId,
    statuses: card.status ? [card.status] : [],
    source: null,
    from: card.withDates ? filters.from : null,
    to: card.withDates ? filters.to : null,
    page: 1,
  });
}

/** The six ADM-12 summary cards; each opens /admin/appointments with matching filters. */
export function SummaryCards({
  filters,
  cards,
  pending,
  trendPercent,
}: {
  filters: DashboardFilters;
  cards: DashboardCards;
  pending: number;
  trendPercent: number | null;
}) {
  const list: Card[] = [
    {
      label: "Total appointments",
      value: cards.total,
      basis: "Scheduled in range",
      status: null,
      withDates: true,
      note: formatTrend(trendPercent),
    },
    { label: "Pending requests", value: pending, basis: "Right now", status: "requested", withDates: false },
    { label: "Confirmed", value: cards.confirmed, basis: "Scheduled in range", status: "confirmed", withDates: true },
    { label: "Completed", value: cards.completed, basis: "Scheduled in range", status: "completed", withDates: true },
    {
      label: "Cancelled",
      value: cards.cancelled,
      basis: "Cancelled in range",
      status: "cancelled",
      withDates: false,
      note: "Opens every cancelled appointment",
    },
    { label: "No-show", value: cards.noShow, basis: "Scheduled in range", status: "no_show", withDates: true },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((card) => (
        <div
          key={card.label}
          role="group"
          aria-label={card.label}
          className="relative flex flex-col gap-1 rounded-xl border border-line bg-surface p-5 shadow-soft transition-colors duration-150 ease-snappy hover:bg-surface-muted motion-reduce:transition-none"
        >
          <Link
            href={cardHref(filters, card)}
            className="text-sm font-medium text-ink-secondary focus-ring after:absolute after:inset-0 after:rounded-[inherit]"
          >
            {card.label}
          </Link>
          <span className="text-3xl font-semibold text-ink tabular-nums">{card.value}</span>
          <span className="text-xs text-ink-muted">{card.basis}</span>
          {card.note ? <span className="text-xs text-ink-secondary">{card.note}</span> : null}
        </div>
      ))}
    </div>
  );
}
