import type { AppointmentRequirement } from "./types";

/**
 * Whether a requirement applies on `today` (a Manila "YYYY-MM-DD" date): it is
 * published and today falls inside its effective dates, both ends inclusive.
 * ISO dates compare correctly as strings.
 */
export function isRequirementEffective(
  requirement: Pick<AppointmentRequirement, "status" | "effectiveFrom" | "effectiveTo">,
  today: string,
): boolean {
  return (
    requirement.status === "published" &&
    requirement.effectiveFrom <= today &&
    (requirement.effectiveTo === null || requirement.effectiveTo >= today)
  );
}
