/** Codes raised by the 0022 requirement functions, with their messages. */
export const REQUIREMENT_REFUSALS = [
  "not_admin",
  "not_found",
  "not_draft",
  "not_published",
  "already_archived",
  "already_superseded",
  "inactive_target",
  "invalid_date",
] as const;

export type RequirementRefusal = (typeof REQUIREMENT_REFUSALS)[number];

export function requirementRefusalFromCode(
  code: string | undefined | null,
): RequirementRefusal | null {
  return REQUIREMENT_REFUSALS.find((refusal) => refusal === code) ?? null;
}
