import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button } from "./button";

/** shadcn Table inside a bordered card, scrolling on narrow screens. */
export function Table({ label, children, footer, className }: { label: string; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-line bg-surface shadow-soft", className)}>
      <div role="region" aria-label={label} tabIndex={0} className="focus-ring overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
      </div>
      {footer}
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("h-10 whitespace-nowrap border-b border-line px-4 text-left text-[13px] font-medium text-ink-muted", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line px-4 py-3 align-middle text-ink [tr:last-child_&]:border-b-0", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-muted/50", className)} {...props} />;
}

export function Pagination({ summary }: { summary: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">
      <span>{summary}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled>
          Previous
        </Button>
        <Button variant="outline" size="sm">
          Next
        </Button>
      </div>
    </div>
  );
}

/** shadcn Alert. Tone carries an icon so status is never colour-only. */
export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: ReactNode; children: ReactNode; className?: string }) {
  const t = {
    info: { box: "border-line-strong bg-accent-soft text-ink", icon: <Info aria-hidden className="text-accent" /> },
    warning: { box: "border-warning/30 bg-warning-soft text-warning-soft-ink", icon: <AlertTriangle aria-hidden /> },
    danger: { box: "border-danger/30 bg-danger-soft text-danger-soft-ink", icon: <XCircle aria-hidden /> },
    success: { box: "border-success/30 bg-success-soft text-success-soft-ink", icon: <CheckCircle2 aria-hidden /> },
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm leading-5 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", t.box, className)}>
      {t.icon}
      <div>
        {title ? <p className="font-medium">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <span className="mb-1 inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4.5">{icon}</span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-secondary">{description}</p>
      {action}
    </div>
  );
}

/** Status history: oldest first, actor and role on each step (design.md §6.10). */
export function Timeline({ steps }: { steps: { title: string; meta: string; done?: boolean }[] }) {
  return (
    <ol className="flex flex-col gap-4 border-l-2 border-line pl-5">
      {steps.map((step) => (
        <li key={step.title + step.meta} className="relative">
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
export function ListRows({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y divide-line">{children}</ul>;
}

export function ListRow({ children, className }: { children: ReactNode; className?: string }) {
  return <li className={cn("flex items-center gap-3 py-3 first:pt-0 last:pb-0", className)}>{children}</li>;
}

/** Sonner-style toast, drawn static for the reference. */
export function ToastPreview({ title, description }: { title: string; description: string }) {
  return (
    <div role="status" className="flex max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-overlay">
      <CheckCircle2 aria-hidden className="mt-0.5 size-4.5 text-success" />
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
    </div>
  );
}

/** Dialog frame drawn open (the repo uses Base UI dialogs; this is the look). */
export function DialogPreview({ title, description, children, footer }: { title: string; description?: string; children?: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex justify-center rounded-2xl bg-overlay p-10">
      <div role="dialog" aria-label={title} className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-overlay">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-sm text-ink-secondary">{description}</p> : null}
        </div>
        {children}
        <div className="flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
