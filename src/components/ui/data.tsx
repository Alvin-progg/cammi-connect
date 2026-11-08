import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A table in its own bordered, scrolling frame, so the page never scrolls
 * sideways (design.md §5.7). The frame is a labelled, focusable region so
 * keyboard users can scroll it, and the caption names the table for screen
 * readers.
 */
export function Table({
  label,
  children,
  footer,
  minWidthClass = "min-w-[640px]",
  className,
}: {
  label: string;
  children: ReactNode;
  footer?: ReactNode;
  /** A Tailwind `min-w-[…]` class; below it the frame scrolls sideways. */
  minWidthClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-surface shadow-soft", className)}>
      <div role="region" aria-label={label} tabIndex={0} className="focus-ring max-h-[70vh] overflow-auto">
        <table className={cn("w-full border-separate border-spacing-0 text-sm", minWidthClass)}>
          <caption className="sr-only">{label}</caption>
          {children}
        </table>
      </div>
      {footer}
    </div>
  );
}

/** Cell classes, also used directly by tables that build their own cells. */
export const HEADER_CELL =
  "sticky top-0 z-10 h-10 whitespace-nowrap border-b border-line bg-surface px-4 text-left text-[13px] font-medium text-ink-muted";
// Row dividers live on the cells: the frame uses separate borders so the
// sticky header keeps its bottom border while scrolling.
export const CELL = "border-b border-line px-4 py-3 align-middle text-sm text-ink [tr:last-child>&]:border-b-0";
export const ROW = "transition-colors hover:bg-surface-muted/50 motion-reduce:transition-none";

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn(HEADER_CELL, className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn(CELL, className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn(ROW, className)} {...props} />;
}

/** shadcn Alert. Tone carries an icon so status is never colour-only. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
  id,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const style = {
    info: { box: "border-line-strong bg-accent-soft text-ink", icon: <Info aria-hidden className="text-accent" /> },
    warning: { box: "border-warning/30 bg-warning-soft text-warning-soft-ink", icon: <AlertTriangle aria-hidden /> },
    danger: { box: "border-danger/30 bg-danger-soft text-danger-soft-ink", icon: <XCircle aria-hidden /> },
    success: { box: "border-success/30 bg-success-soft text-success-soft-ink", icon: <CheckCircle2 aria-hidden /> },
  }[tone];
  return (
    <div
      id={id}
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 text-sm leading-5 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        style.box,
        className,
      )}
    >
      {style.icon}
      <div>
        {title ? <p className="font-medium">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

/**
 * The dashed empty-state panel. Short list placeholders pass only `children`
 * (a sentence); full empty states pass an icon, title, and description.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  children,
  className,
}: {
  className?: string;
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  if (!title) {
    return (
      <p className={cn("rounded-xl border border-dashed border-line-strong px-4 py-6 text-sm text-ink-muted", className)}>
        {children ?? description}
      </p>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="mb-1 inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4.5">
          {icon}
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description || children ? <p className="text-sm text-ink-secondary">{description ?? children}</p> : null}
      {action}
    </div>
  );
}

/** Status history: oldest first, actor and role on each step (design.md §6.10). */
export function Timeline({ steps }: { steps: { key: string; title: ReactNode; meta: ReactNode; done?: boolean }[] }) {
  return (
    <ol className="flex flex-col gap-4 border-l-2 border-line pl-5">
      {steps.map((step) => (
        <li key={step.key} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute -left-[27px] top-1 size-3 rounded-full border-2",
              step.done ? "border-primary bg-primary" : "border-line-strong bg-surface",
            )}
          />
          <p className={cn("text-sm font-medium", step.done ? "text-ink" : "text-ink-muted")}>{step.title}</p>
          <p className="text-xs text-ink-muted">{step.meta}</p>
        </li>
      ))}
    </ol>
  );
}

/** Divider list for small feeds inside cards. */
export function ListRows({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("flex flex-col divide-y divide-line", className)}>{children}</ul>;
}

export function ListRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("flex items-center gap-3 py-3 first:pt-0 last:pb-0", className)}>{children}</li>;
}
