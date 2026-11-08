"use client";

import { useState } from "react";

import { CONTROL_CLASS } from "@/components/ui/field";

/**
 * Preset reason radios plus a details box, shared by the reject, cancel, and
 * reschedule forms. Details become required when "other" is chosen; the
 * server schema enforces the same rule.
 */
export function ReasonFields<Reason extends string>({
  idPrefix,
  reasons,
  labels,
  note,
}: {
  idPrefix: string;
  reasons: readonly Reason[];
  labels: Record<Reason, string>;
  note: string;
}) {
  const [reason, setReason] = useState<Reason | null>(null);
  const detailsId = `${idPrefix}-details`;
  const legendId = `${idPrefix}-reason`;

  return (
    <>
      <fieldset className="mt-4">
        <legend id={legendId} className="text-sm font-medium text-ink">
          Reason
        </legend>
        <div role="radiogroup" aria-labelledby={legendId} className="mt-2 flex flex-col gap-1">
          {reasons.map((value) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-ink hover:bg-surface-muted"
            >
              <input
                type="radio"
                name="reason"
                value={value}
                required
                checked={reason === value}
                onChange={() => setReason(value)}
                className="size-4 accent-primary"
              />
              {labels[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={detailsId} className="mt-4 block text-sm font-medium text-ink">
        {reason === "other" ? "Details (required)" : "Details (optional)"}
      </label>
      <textarea
        id={detailsId}
        name="details"
        rows={3}
        maxLength={500}
        required={reason === "other"}
        className={`mt-1.5 ${CONTROL_CLASS} py-2 leading-6`}
      />
      <p className="mt-2 text-xs text-ink-muted">{note}</p>
    </>
  );
}
