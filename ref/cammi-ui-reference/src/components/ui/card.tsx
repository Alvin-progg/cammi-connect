import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** shadcn Card: rounded-xl, 1px line border, one quiet shadow. */
export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-xl border border-line bg-surface p-6 shadow-soft", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold leading-7 text-ink">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** A KPI tile: label, big number, one line of context. */
export function KpiCard({ label, value, detail, detailTone = "muted" }: { label: string; value: ReactNode; detail?: ReactNode; detailTone?: "muted" | "warning" | "danger" | "success" }) {
  const tone = {
    muted: "text-ink-muted",
    warning: "text-warning",
    danger: "text-danger",
    success: "text-success",
  }[detailTone];
  return (
    <Card className="p-5">
      <p className="text-sm text-ink-secondary">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums text-ink">{value}</p>
      {detail ? <p className={cn("mt-1 text-xs", tone)}>{detail}</p> : null}
    </Card>
  );
}

/** Icon in a tinted square (feature icons, list leading icons). */
export function IconTile({ children, tone = "primary", className }: { children: ReactNode; tone?: "primary" | "ai" | "warning" | "success"; className?: string }) {
  const t = {
    primary: "bg-primary-soft text-primary",
    ai: "bg-accent-soft text-accent",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
  }[tone];
  return <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5", t, className)}>{children}</span>;
}

export function Avatar({ initials, size = "md", className }: { initials: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = { sm: "size-7 text-[11px]", md: "size-8 text-xs", lg: "size-14 text-lg" }[size];
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent", s, className)}>
      {initials}
    </span>
  );
}

/** Definition list in a two-column grid (details cards). */
export function DetailList({ items, termWidth = "9rem" }: { items: [ReactNode, ReactNode][]; termWidth?: string }) {
  return (
    <dl className="grid gap-x-4 gap-y-2.5 text-sm" style={{ gridTemplateColumns: `${termWidth} minmax(0,1fr)` }}>
      {items.map(([term, value], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-muted">{term}</dt>
          <dd className="text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
