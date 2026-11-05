import {
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
} from "@/lib/requirements/types";

const BADGE_CLASS = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium";

const STATUS_CLASSES: Record<RequirementStatus, string> = {
  draft: "bg-warning-soft text-warning-soft-ink",
  published: "bg-primary-soft text-primary",
  archived: "bg-surface-muted text-ink-secondary",
};

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return (
    <span className={`${BADGE_CLASS} ${STATUS_CLASSES[status]}`}>
      {REQUIREMENT_STATUS_LABELS[status]}
    </span>
  );
}

/** Marks a published requirement whose effective dates include today. */
export function InEffectBadge() {
  return <span className={`${BADGE_CLASS} bg-success-soft text-success-soft-ink`}>In effect</span>;
}
