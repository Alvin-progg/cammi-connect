import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/data";
import { SMALL_SAMPLE_NOTE } from "@/lib/analytics/display";

/**
 * One analytics chart on an opaque card. An empty period shows a message
 * instead of a zero-filled chart (design.md §6.8); otherwise the chart comes
 * with its data table behind a disclosure.
 */
export function ChartCard({
  id,
  title,
  description,
  emptyMessage,
  smallSample = false,
  table,
  children,
}: {
  id: string;
  title: string;
  description: string;
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
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card"
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink-secondary">{description}</p>
        {smallSample && !emptyMessage ? <p className="text-xs text-warning-soft-ink">{SMALL_SAMPLE_NOTE}</p> : null}
      </header>
      {emptyMessage ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <>
          {children}
          {table ? (
            <details className="group text-sm">
              <summary className="cursor-pointer rounded text-primary focus-ring hover:text-primary-hover">
                Show data table
              </summary>
              <div className="mt-3">{table}</div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
