import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** The status shape every admin form action returns. */
export type AdminFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const FIELD_CLASS =
  "min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus-ring";
export const LABEL_CLASS = "text-sm font-medium text-ink";

export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function FormFooter({
  state,
  pending,
  label,
  pendingLabel = "Saving…",
  variant = "primary",
}: {
  state: AdminFormState;
  pending: boolean;
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "outlineDanger";
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/** A titled card for one admin task on the user details page. */
export function TaskCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = `${title.toLowerCase().replace(/[^a-z]+/g, "-")}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-card"
    >
      <div>
        <h2 id={headingId} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-ink-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
