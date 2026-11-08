"use client";

import { Popover } from "@base-ui/react/popover";

import { CountUp } from "@/components/ui/count-up";
import { KPI_DEFINITIONS, SMALL_SAMPLE_NOTE, formatMonthRange, isSmallSample } from "@/lib/analytics/display";
import { DAYTIME_SLOT_SHORT_LABELS, type AnalyticsDatasets } from "@/lib/analytics/metrics";

/** A card's value: animated numbers, or plain text (peak slot, the paired rates). */
type KpiValue =
  | { kind: "number"; value: number; decimals: number; suffix: string }
  | { kind: "text"; text: string }
  | { kind: "empty" };
type Kpi = { label: string; definition: string; value: KpiValue; detail: string };

function Definition({ label, definition }: { label: string; definition: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        aria-label={`How ${label.toLowerCase()} is measured`}
        className="inline-flex size-5 items-center justify-center rounded-full border border-line text-[11px] text-ink-muted focus-ring hover:bg-surface-muted"
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

const VALUE_CLASS = "mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-ink";

function rateValue(rate: number | null): KpiValue {
  return rate === null ? { kind: "empty" } : { kind: "number", value: rate, decimals: 1, suffix: "%" };
}

/**
 * The four reference KPIs (definitions in docs/analytics-definitions.md v2):
 * appointments in the period, the completion rate and the cancellation and
 * no-show rates over the finished visits of the outcome months, and the peak
 * daytime slot. 4 across at xl, 2 at sm, 1 on mobile.
 */
export function KpiCards({ kpis, periodLabel }: { kpis: AnalyticsDatasets["kpis"]; periodLabel: string }) {
  const months = kpis.outcomeMonths ? formatMonthRange(kpis.outcomeMonths.first, kpis.outcomeMonths.last) : null;
  const finished = (label: string) => (months ? `${label}, ${months}` : label);
  const cards: Kpi[] = [
    {
      label: `Appointments ${periodLabel}`,
      definition: KPI_DEFINITIONS.total,
      value: { kind: "number", value: kpis.total, decimals: 0, suffix: "" },
      detail: kpis.busiestMonth
        ? `${formatMonthRange(kpis.busiestMonth.month, kpis.busiestMonth.month)} is the busiest month (${kpis.busiestMonth.total})`
        : "Scheduled in this period",
    },
    {
      label: finished("Completed"),
      definition: KPI_DEFINITIONS.completion,
      value: rateValue(kpis.completionRate),
      detail:
        kpis.outcomeCount > 0 ? `${kpis.completed} of ${kpis.outcomeCount} appointments` : "No visits have finished yet",
    },
    {
      label: finished("Cancelled · No-show"),
      definition: KPI_DEFINITIONS.cancellationNoShow,
      value:
        kpis.cancellationRate === null || kpis.noShowRate === null
          ? { kind: "empty" }
          : { kind: "text", text: `${kpis.cancellationRate.toFixed(1)}% · ${kpis.noShowRate.toFixed(1)}%` },
      detail:
        kpis.outcomeCount > 0
          ? `${kpis.cancelled} cancelled · ${kpis.noShow} ${kpis.noShow === 1 ? "no-show" : "no-shows"}`
          : "No visits have finished yet",
    },
    {
      label: "Peak slot",
      definition: KPI_DEFINITIONS.peakSlot,
      value: kpis.peakSlot
        ? { kind: "text", text: `${kpis.peakSlot.weekday} ${DAYTIME_SLOT_SHORT_LABELS[kpis.peakSlot.slot]}` }
        : { kind: "empty" },
      detail: kpis.peakSlot
        ? `${kpis.peakSlot.count} ${kpis.peakSlot.count === 1 ? "appointment" : "appointments"}`
        : "No daytime appointments",
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            role="group"
            aria-label={card.label}
            className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-soft"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink-secondary">{card.label}</span>
              <Definition label={card.label} definition={card.definition} />
            </div>
            <div data-kpi-value className={card.value.kind === "empty" ? `${VALUE_CLASS} text-ink-muted` : VALUE_CLASS}>
              {card.value.kind === "number" ? (
                <CountUp value={card.value.value} decimals={card.value.decimals} suffix={card.value.suffix} />
              ) : card.value.kind === "text" ? (
                card.value.text
              ) : (
                "—"
              )}
            </div>
            <span className="mt-1 text-xs text-ink-muted">{card.detail}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        {kpis.pending} pending confirmation now (front desk queue; not limited to this period).
        {isSmallSample(kpis.outcomeCount) ? <span className="ml-2 text-warning-soft-ink">{SMALL_SAMPLE_NOTE}</span> : null}
      </p>
    </div>
  );
}
