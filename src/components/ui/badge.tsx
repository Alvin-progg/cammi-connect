import { cva, type VariantProps } from "class-variance-authority";
import { Ban, CheckCircle2, Circle, CircleCheck, Clock, UserCheck, UserX, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/lib/appointments/status";
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

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

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
 * Labels come from `APPOINTMENT_STATUS_LABELS`; the icon keeps status from
 * being colour-only.
 */
const STATUS_STYLE: Record<AppointmentStatus, { tone: BadgeTone; icon: ReactNode }> = {
  requested: { tone: "warning", icon: <Clock aria-hidden /> },
  rejected: { tone: "danger", icon: <XCircle aria-hidden /> },
  confirmed: { tone: "info", icon: <CircleCheck aria-hidden /> },
  checked_in: { tone: "success", icon: <UserCheck aria-hidden /> },
  completed: { tone: "success", icon: <CheckCircle2 aria-hidden /> },
  cancelled: { tone: "danger", icon: <Ban aria-hidden /> },
  no_show: { tone: "neutral", icon: <UserX aria-hidden /> },
};

export function StatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const style = STATUS_STYLE[status];
  return (
    <Badge tone={style.tone} className={className}>
      {style.icon}
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Active / inactive for directory records (departments, doctors, users…). */
export function ActiveBadge({
  isActive,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: {
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <Badge tone={isActive ? "success" : "neutral"}>
      <Circle aria-hidden className="fill-current" />
      {isActive ? activeLabel : inactiveLabel}
    </Badge>
  );
}
