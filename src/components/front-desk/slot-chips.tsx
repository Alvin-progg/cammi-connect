"use client";

import { Check } from "lucide-react";

import { formatManilaTime } from "@/lib/appointments/format";

/**
 * Free times as a grid of chips (redesign). Each chip is a labelled radio, so
 * the group keeps native keyboard behavior; the checked chip gets a 2px
 * primary border, a tint, and a check icon so selection is not color-only.
 */
export function SlotChips({
  legend,
  name,
  slots,
  onSelect,
}: {
  legend: string;
  name: string;
  slots: readonly { start: string }[];
  onSelect?: (start: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
        {slots.map((slot) => (
          <label
            key={slot.start}
            className="group flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-lg border border-line-strong bg-surface px-2 text-sm font-medium tabular-nums text-ink pressable hover:bg-primary-soft has-checked:border-2 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:ring-3 has-focus-visible:ring-primary/25"
          >
            <input
              type="radio"
              name={name}
              value={slot.start}
              required
              onChange={() => onSelect?.(slot.start)}
              className="sr-only"
            />
            <Check aria-hidden="true" className="hidden size-4 text-primary group-has-checked:block" />
            {formatManilaTime(slot.start)}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Times are in Philippine time (Asia/Manila).</p>
    </fieldset>
  );
}
