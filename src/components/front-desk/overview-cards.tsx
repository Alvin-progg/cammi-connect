import clsx from "clsx";
import Link from "next/link";

import type { OverviewCounts } from "@/lib/front-desk/overview";

const CARDS: { key: keyof OverviewCounts; label: string; hint: string }[] = [
  { key: "pending", label: "Pending requests", hint: "Waiting for staff review" },
  { key: "confirmedToday", label: "Confirmed today", hint: "Confirmed or booked today" },
  { key: "completedToday", label: "Completed today", hint: "Marked completed today" },
  { key: "cancelledToday", label: "Cancelled today", hint: "Cancelled today" },
];

/**
 * The four summary cards (SPEC-frontdesk §4). Pending comes first and is
 * emphasised because it is the only one that needs staff action.
 */
export function OverviewCards({ counts }: { counts: OverviewCounts }) {
  return (
    <ul aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card) => {
        const pending = card.key === "pending";
        // Pending is the only card that asks staff to act, so it is tinted
        // while anything is waiting.
        const needsAction = pending && counts.pending > 0;
        return (
          <li
            key={card.key}
            className={clsx(
              "flex flex-col rounded-xl border p-5 shadow-soft",
              needsAction ? "border-primary/40 bg-primary-soft" : "border-line bg-surface",
            )}
          >
            <span className="text-sm text-ink-secondary">{card.label}</span>
            <span
              className={clsx(
                "mt-1.5 text-3xl font-semibold tabular-nums tracking-tight",
                needsAction ? "text-primary" : "text-ink",
              )}
            >
              {counts[card.key]}
            </span>
            {pending ? (
              <Link
                href="/front-desk/requests"
                className="focus-ring mt-1 self-start rounded text-xs font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline"
              >
                Review pending requests
              </Link>
            ) : (
              <span className="mt-1 text-xs text-ink-muted">{card.hint}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
