import Link from "next/link";

import { EmptyState } from "@/components/admin/empty-state";
import { formatManilaMediumDate } from "@/lib/appointments/format";
import { isRequirementEffective } from "@/lib/requirements/effective";
import { groupRequirementsByTarget } from "@/lib/requirements/group";
import {
  REQUIREMENT_TARGET_KIND_LABELS,
  type AppointmentRequirement,
  type RequirementTarget,
} from "@/lib/requirements/types";

import { InEffectBadge, RequirementStatusBadge } from "./requirement-badges";

const LINK_CLASS =
  "rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline";

/** "From Nov 1, 2026" or "Nov 1, 2026 – Dec 31, 2026". */
export function formatEffectiveDates(
  requirement: Pick<AppointmentRequirement, "effectiveFrom" | "effectiveTo">,
): string {
  const from = formatManilaMediumDate(requirement.effectiveFrom);
  return requirement.effectiveTo
    ? `${from} – ${formatManilaMediumDate(requirement.effectiveTo)}`
    : `From ${from}`;
}

function targetHref(target: RequirementTarget): string {
  return target.kind === "service"
    ? `/admin/services/${target.id}`
    : `/admin/specialties/${target.id}`;
}

function RequirementItems({
  requirements,
  today,
}: {
  requirements: AppointmentRequirement[];
  today: string;
}) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {requirements.map((requirement) => (
        <li key={requirement.id} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/requirements/${requirement.id}`} className={LINK_CLASS}>
              {requirement.title}
            </Link>
            <RequirementStatusBadge status={requirement.status} />
            {isRequirementEffective(requirement, today) ? <InEffectBadge /> : null}
          </div>
          <p className="text-sm text-ink-secondary">
            {requirement.isMandatory ? "Mandatory" : "Optional"} · {formatEffectiveDates(requirement)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Requirements grouped under their service or specialty, or as one flat list
 * (on a service page, where the target is already known).
 */
export function RequirementsList({
  requirements,
  today,
  grouped = true,
}: {
  requirements: AppointmentRequirement[];
  today: string;
  grouped?: boolean;
}) {
  if (requirements.length === 0) {
    return <EmptyState>No requirements match.</EmptyState>;
  }
  if (!grouped) {
    return <RequirementItems requirements={requirements} today={today} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {groupRequirementsByTarget(requirements).map(({ target, requirements: items }) => {
        const headingId = `requirements-${target.kind}-${target.id}`;
        return (
          <section key={headingId} aria-labelledby={headingId} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h2 id={headingId} className="text-base font-semibold text-ink">
                <Link href={targetHref(target)} className={LINK_CLASS}>
                  {target.name ?? "Unknown"}
                </Link>
              </h2>
              <span className="text-xs text-ink-muted">
                {REQUIREMENT_TARGET_KIND_LABELS[target.kind]}
              </span>
            </div>
            <RequirementItems requirements={items} today={today} />
          </section>
        );
      })}
    </div>
  );
}
