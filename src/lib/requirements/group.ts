import type { AppointmentRequirement, RequirementTarget } from "./types";

export type RequirementGroup = {
  target: RequirementTarget;
  requirements: AppointmentRequirement[];
};

/**
 * Groups requirements by their service or specialty: services first, then
 * specialties, each sorted by name. Requirements keep their input order.
 */
export function groupRequirementsByTarget(
  requirements: AppointmentRequirement[],
): RequirementGroup[] {
  const groups = new Map<string, RequirementGroup>();
  for (const requirement of requirements) {
    const key = `${requirement.target.kind}:${requirement.target.id}`;
    const group = groups.get(key);
    if (group) {
      group.requirements.push(requirement);
    } else {
      groups.set(key, { target: requirement.target, requirements: [requirement] });
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      kindOrder(a.target) - kindOrder(b.target) ||
      (a.target.name ?? "").localeCompare(b.target.name ?? ""),
  );
}

function kindOrder(target: RequirementTarget): number {
  return target.kind === "service" ? 0 : 1;
}
