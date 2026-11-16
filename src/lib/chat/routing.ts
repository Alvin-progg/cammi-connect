import { matchSpecialtiesByName } from "@/lib/chat/resolve";

/**
 * Need-based specialty routing (AI-APT-002). The LLM only suggests candidate
 * names; these deterministic rules decide which specialty Cami offers, and
 * only ever pick an active specialty that has an active doctor.
 */

export type RoutableSpecialty = {
  id: string;
  name: string;
  isActive: boolean;
  hasActiveDoctors: boolean;
};

/** The routing fields of the intent extraction, or the care need saved in the draft. */
export type RoutingInput = {
  /** A specialty the patient named themselves; it always wins. */
  specialtyName?: string | null;
  specialtyCandidates?: string[] | null;
  routingConfidence?: "high" | "low" | null;
  age?: number | null;
};

/** The admin's `chatbot.first_contact_specialty_adult` and `_child` (ADM-15). */
export type FirstContactSettings = { adult: string; child: string };

export type SpecialtyRoute = {
  specialtyId: string;
  /** A second close match, offered as a one-tap alternative. */
  alternativeId?: string;
  reason: "named" | "matched" | "age_rule" | "first_contact";
};

export const DEFAULT_FIRST_CONTACT: FirstContactSettings = {
  adult: "Family Medicine",
  child: "Pediatrics",
};

/** R3: adults fall back from Family Medicine to Internal Medicine. */
const ADULT_FALLBACKS = ["Family Medicine", "Internal Medicine"];

const ADULT_AGE = 18;

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

export function routeToSpecialty(
  input: RoutingInput,
  specialties: RoutableSpecialty[],
  settings: FirstContactSettings,
): SpecialtyRoute | null {
  const bookable = specialties.filter((entry) => entry.isActive && entry.hasActiveDoctors);
  // Exact names only: a candidate that is not on the hospital's list is dropped.
  const byName = (name: string) => bookable.find((entry) => normalise(entry.name) === normalise(name));

  const named = input.specialtyName?.trim();
  if (named) {
    const matches = matchSpecialtiesByName(named, bookable);
    if (matches.length === 1) return { specialtyId: matches[0].id, reason: "named" };
  }

  const isChild = input.age != null && input.age < ADULT_AGE;
  if (isChild) {
    const pediatrics = byName(settings.child);
    if (pediatrics) return { specialtyId: pediatrics.id, reason: "age_rule" };
  }

  if (input.routingConfidence === "high") {
    const candidates = [
      ...new Set((input.specialtyCandidates ?? []).map(byName).filter((entry) => entry !== undefined)),
    ];
    if (candidates.length > 0) {
      return {
        specialtyId: candidates[0].id,
        ...(candidates[1] ? { alternativeId: candidates[1].id } : {}),
        reason: "matched",
      };
    }
  }

  const firstContactNames = [
    ...(isChild ? [settings.child, DEFAULT_FIRST_CONTACT.child] : []),
    settings.adult,
    ...ADULT_FALLBACKS,
  ];
  for (const name of firstContactNames) {
    const specialty = byName(name);
    if (specialty) return { specialtyId: specialty.id, reason: "first_contact" };
  }
  return null;
}
