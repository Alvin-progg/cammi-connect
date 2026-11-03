import type { ReactNode } from "react";

/** The dashed empty-state panel used by front desk lists and tables. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
      {children}
    </p>
  );
}
