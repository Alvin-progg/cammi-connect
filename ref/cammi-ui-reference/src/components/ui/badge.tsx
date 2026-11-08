import { cva, type VariantProps } from "class-variance-authority";
import { Ban, CheckCircle2, Circle, CircleCheck, Clock, UserCheck, UserX, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-line-strong bg-surface-muted text-ink-secondary",
        info: "border-primary/30 bg-primary-soft text-primary-hover",
        success: "border-success/30 bg-success-soft text-success-soft-ink",
        warning: "border-warning/30 bg-warning-soft text-warning-soft-ink",
        danger: "border-danger/30 bg-danger-soft text-danger-soft-ink",
        ai: "border-accent/30 bg-accent-soft text-accent",
        outline: "border-line-strong bg-surface text-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  tone,
  className,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/**
 * The one status map for appointments (design.md §5.5). A requested
 * appointment is warning tone; blue means confirmed, never "success".
 */
/** Mirrors `APPOINTMENT_STATUSES` in src/lib/appointments/status.ts; labels match `APPOINTMENT_STATUS_LABELS`. */
export type AppointmentStatus = "requested" | "confirmed" | "rejected" | "cancelled" | "checked_in" | "completed" | "no_show";

const STATUS: Record<AppointmentStatus, { label: string; tone: VariantProps<typeof badgeVariants>["tone"]; icon: ReactNode }> = {
  requested: { label: "Pending confirmation", tone: "warning", icon: <Clock aria-hidden /> },
  rejected: { label: "Rejected", tone: "danger", icon: <XCircle aria-hidden /> },
  confirmed: { label: "Confirmed", tone: "info", icon: <CircleCheck aria-hidden /> },
  checked_in: { label: "Checked in", tone: "success", icon: <UserCheck aria-hidden /> },
  completed: { label: "Completed", tone: "success", icon: <CheckCircle2 aria-hidden /> },
  cancelled: { label: "Cancelled", tone: "danger", icon: <Ban aria-hidden /> },
  no_show: { label: "No-show", tone: "neutral", icon: <UserX aria-hidden /> },
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} className={className}>
      {s.icon}
      {s.label}
    </Badge>
  );
}

/** Active / inactive for directory records (departments, doctors, users…). */
export function ActiveBadge({ active, activeLabel = "Active", inactiveLabel = "Inactive" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return (
    <Badge tone={active ? "success" : "neutral"}>
      <Circle aria-hidden className="fill-current" />
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}
