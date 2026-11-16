import type { RevenueFigure, RevenueSummary } from "@/lib/analytics/revenue";
import { formatPesos } from "@/lib/billing/money";

import { ChartSection } from "./chart-card";

function payments(count: number): string {
  return `${count} ${count === 1 ? "payment" : "payments"}`;
}

/**
 * PAY-08 revenue numbers for the analytics period (docs/analytics-definitions.md,
 * "Revenue"). Hospital-wide: chat payments for consultations and services.
 */
export function RevenueCards({ revenue }: { revenue: RevenueSummary }) {
  const cards: { label: string; figure: RevenueFigure; detail: string }[] = [
    { label: "Collected", figure: revenue.collected, detail: "Verified in this period" },
    { label: "Refunded", figure: revenue.refunded, detail: "Refunds sent in this period" },
    { label: "Refund due now", figure: revenue.refundDue, detail: "Paid, then cancelled; not sent yet" },
    { label: "Outstanding now", figure: revenue.outstanding, detail: "Unpaid requests waiting for payment" },
    { label: "HMO approved", figure: revenue.hmoApproved, detail: "HMO share approved in this period" },
  ];

  return (
    <section aria-label="Revenue" className="flex flex-col gap-4">
      <ChartSection
        title="Revenue"
        description="Chat payments for consultations and services, hospital-wide (doctor and department filters don't apply)"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            role="group"
            aria-label={card.label}
            className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-soft"
          >
            <span className="text-sm text-ink-secondary">{card.label}</span>
            <span className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-ink">
              {formatPesos(card.figure.centavos)}
            </span>
            <span className="mt-1 text-xs text-ink-muted">{`${card.detail} · ${payments(card.figure.count)}`}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
