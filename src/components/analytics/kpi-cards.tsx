"use client";

import { Popover } from "@base-ui/react/popover";

import { CountUp } from "@/components/ui/count-up";
import { KPI_DEFINITIONS, SMALL_SAMPLE_NOTE, isSmallSample } from "@/lib/analytics/display";
import type { AnalyticsDatasets } from "@/lib/analytics/metrics";

type Kpi = { label: string; definition: string; value: number | null; isRate: boolean };

function Definition({ label, definition }: { label: string; definition: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        aria-label={`How ${label.toLowerCase()} is measured`}
        className="inline-flex size-6 items-center justify-center rounded-full border border-line text-xs text-ink-muted focus-ring hover:bg-surface-muted"
      >
        ?
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-50">
          <Popover.Popup className="max-w-72 rounded-lg border border-line bg-surface p-3 text-sm text-ink shadow-card">
            <Popover.Title className="font-medium">{label}</Popover.Title>
            <Popover.Description className="mt-1 text-ink-secondary">{definition}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The four measured KPIs (ADM-11); 4 across at lg, 2 at md, 1 on mobile (design.md §6.8). */
export function KpiCards({ kpis }: { kpis: AnalyticsDatasets["kpis"] }) {
  const cards: Kpi[] = [
    { label: "Total appointments", definition: KPI_DEFINITIONS.total, value: kpis.total, isRate: false },
    { label: "Completion rate", definition: KPI_DEFINITIONS.completion, value: kpis.completionRate, isRate: true },
    {
      label: "Cancellation rate",
      definition: KPI_DEFINITIONS.cancellation,
      value: kpis.cancellationRate,
      isRate: true,
    },
    { label: "No-show rate", definition: KPI_DEFINITIONS.noShow, value: kpis.noShowRate, isRate: true },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            role="group"
            aria-label={card.label}
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5 shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink-secondary">{card.label}</span>
              <Definition label={card.label} definition={card.definition} />
            </div>
            {card.value === null ? (
              <span className="text-3xl font-semibold text-ink-muted">—</span>
            ) : (
              <CountUp
                value={card.value}
                decimals={card.isRate ? 2 : 0}
                suffix={card.isRate ? "%" : ""}
                className="text-3xl font-semibold text-ink"
              />
            )}
            {card.isRate ? (
              <span className="text-xs text-ink-muted">
                {card.value === null ? "Nothing due yet in this period" : `of ${kpis.dueCount} due visits`}
              </span>
            ) : (
              <span className="text-xs text-ink-muted">Scheduled in this period</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-secondary">
        {kpis.pending} pending confirmation now (front desk queue; not limited to this period).
        {isSmallSample(kpis.dueCount) ? <span className="ml-2 text-warning-soft-ink">{SMALL_SAMPLE_NOTE}</span> : null}
      </p>
    </div>
  );
}
