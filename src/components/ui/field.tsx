import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * shadcn-style form controls. Borders use `control-line` (3:1 against white),
 * not shadcn's lighter default. Staff screens use h-9; patient and auth
 * screens pass `className="h-11"`.
 */
const CONTROL =
  "w-full rounded-md border border-control-line bg-surface px-3 text-sm text-ink shadow-soft placeholder:text-ink-muted outline-none transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25 disabled:bg-surface-muted disabled:text-ink-muted aria-invalid:border-2 aria-invalid:border-danger";

/**
 * Class string for a native control a component renders itself (filters,
 * forms with their own markup). Same look as `Input`/`Select`.
 */
export const CONTROL_CLASS = `${CONTROL} min-h-9`;

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-9", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(CONTROL, "h-9 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "min-h-24 py-2 leading-6", className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-ink", className)} {...props} />;
}

/** Label + control + hint or error, stacked (design.md §5.3). */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  errorId,
  className,
  labelAction,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  errorId?: string;
  className?: string;
  labelAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, hint, className, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex items-start gap-3", className)}>
      <input type="checkbox" className="mt-0.5 size-4.5 shrink-0 accent-primary" {...props} />
      <span>
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

/** A bordered group of fields with a legend (forms on detail/new pages). */
export function Fieldset({ legend, description, children, className }: { legend: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("m-0 flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-soft", className)}>
      <legend className="px-1.5 text-[15px] font-semibold text-ink">{legend}</legend>
      {description ? <p className="-mt-2 text-sm text-ink-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
}

/** Responsive field grid: 1 column on phones, 2+ when there is room. */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-x-5 gap-y-4 sm:grid-cols-2", className)}>{children}</div>;
}

/** Choice cards (radio) used for role and access-mode pickers. */
export function ChoiceCard({
  title,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "title"> & { title: ReactNode; description: ReactNode }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:bg-surface-muted has-checked:border-primary has-checked:bg-primary-soft",
        className,
      )}
    >
      <input type="radio" className="mt-0.5 size-4 accent-primary" {...props} />
      <span>
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-ink-muted">{description}</span>
      </span>
    </label>
  );
}

/** Save bar at the end of a form. */
export function FormFooter({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
      {note ? <p className="mr-auto text-xs text-ink-muted">{note}</p> : null}
      {children}
    </div>
  );
}
