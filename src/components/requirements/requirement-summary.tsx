import { formatManilaMediumDate } from "@/lib/appointments/format";
import {
  REQUIREMENT_TARGET_KIND_LABELS,
  type AppointmentRequirement,
} from "@/lib/requirements/types";

/** Read-only details for a published or archived requirement. */
export function RequirementSummary({ requirement }: { requirement: AppointmentRequirement }) {
  const rows: [string, string][] = [
    [REQUIREMENT_TARGET_KIND_LABELS[requirement.target.kind], requirement.target.name ?? "Unknown"],
    ["Description", requirement.description ?? "No description"],
    ["Type", requirement.isMandatory ? "Mandatory" : "Optional"],
    ["Effective from", formatManilaMediumDate(requirement.effectiveFrom)],
    [
      "Effective until",
      requirement.effectiveTo ? formatManilaMediumDate(requirement.effectiveTo) : "No end date",
    ],
  ];

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-muted">{label}</dt>
          <dd className="whitespace-pre-line text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
