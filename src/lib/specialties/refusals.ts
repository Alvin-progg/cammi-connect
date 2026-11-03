/** Codes raised by the 0016 specialty functions, with their messages. */
export const SPECIALTY_REFUSALS = ["not_admin", "duplicate", "not_found", "unchanged"] as const;

export type SpecialtyRefusal = (typeof SPECIALTY_REFUSALS)[number];

export const SPECIALTY_REFUSAL_MESSAGES: Record<SpecialtyRefusal, string> = {
  not_admin: "Only an active administrator can manage specialties.",
  duplicate: "A specialty with that name already exists.",
  not_found: "That specialty no longer exists.",
  unchanged: "Nothing to change.",
};

export function specialtyRefusalFromCode(
  code: string | undefined | null,
): SpecialtyRefusal | null {
  return SPECIALTY_REFUSALS.find((refusal) => refusal === code) ?? null;
}
