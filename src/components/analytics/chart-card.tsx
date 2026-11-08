import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/data";
import { SMALL_SAMPLE_NOTE } from "@/lib/analytics/display";

/**
 * One analytics chart on an opaque card (reference layout): a numbered title
 * with a caption or legend on the right, a one-line description, the chart,
 * and its data table behind "View as table". An empty period shows a message
 * instead of a zero-filled chart (design.md §6.8).
 */
export function ChartCard({
  id,
  number,
  title,
  description,
  aside,
  emptyMessage,
  smallSample = false,
  table,
  children,
}: {
  id: string;
  /** Position on the page; shown before the title, not part of its name. */
  number?: number;
  title: string;
  description: string;
  /** A caption ("Appointments per month") or a series legend. */
  aside?: ReactNode;
  /** Set when the period has nothing to chart. */
  emptyMessage: string | null;
  smallSample?: boolean;
  table?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-6 shadow-soft"
    >
      <header className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id={headingId} className="text-lg font-semibold text-ink">
          {number !== undefined ? <span aria-hidden="true">{`${number} · `}</span> : null}
          {title}
        </h2>
        {aside && !emptyMessage ? aside : null}
      </header>
      <p className="mb-4 text-[13px] text-ink-muted">{description}</p>
      {smallSample && !emptyMessage ? (
        <p className="-mt-2 mb-4 text-xs text-warning-soft-ink">{SMALL_SAMPLE_NOTE}</p>
      ) : null}
      {emptyMessage ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <>
          <div className="flex-1">{children}</div>
          {table ? (
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer rounded font-medium text-primary focus-ring hover:text-primary-hover">
                View as table
              </summary>
              <div className="mt-2 overflow-x-auto">{table}</div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Series key for a chart card's header. Each swatch is paired with its label. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-3.5 text-xs text-ink-secondary">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** "Demand" / "Outcomes" section heading between chart groups. */
export function ChartSection({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3 border-t border-line pt-4">
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="text-sm text-ink-secondary">{description}</p>
    </div>
  );
}
