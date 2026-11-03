import clsx from "clsx";
import type { ReactNode } from "react";

/** Header and body cells for front desk tables (design.md §5.7). */
export const HEADER_CELL =
  "sticky top-0 z-10 border-b border-line bg-surface-muted px-4 py-3 text-left text-sm font-medium text-ink-secondary";
// Row dividers live on the cells: the frame uses separate borders so the
// sticky header keeps its bottom border while scrolling.
export const CELL =
  "border-b border-line px-4 py-3 align-top text-sm text-ink [tr:last-child>&]:border-b-0";
export const ROW =
  "transition-colors duration-150 ease-snappy hover:bg-surface-muted motion-reduce:transition-none";

/**
 * A table in its own scroll frame, so the page never scrolls sideways
 * (design.md §5.7). The frame is a labelled, focusable region so keyboard
 * users can scroll it, and the caption names the table for screen readers.
 * The header stays in view when the frame scrolls vertically.
 */
export function TableFrame({
  label,
  minWidthClass,
  children,
}: {
  label: string;
  /** A Tailwind `min-w-[…]` class; below it the frame scrolls sideways. */
  minWidthClass: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="focus-ring max-h-[70vh] overflow-auto rounded-xl border border-line bg-surface shadow-card"
    >
      <table className={clsx("w-full border-separate border-spacing-0", minWidthClass)}>
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}
