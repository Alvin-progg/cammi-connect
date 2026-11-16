import type { RoutingEvalExpected } from "@/lib/chat/routing-eval";

/**
 * AI-APT-002 routing evaluation set (ADR-0009): 40 synthetic patient
 * messages in English, Tagalog, and Taglish. None of these are real patient
 * messages. `npm run eval:routing` runs them against the real model.
 */

/** The synthetic seed's specialties and routing hints (scripts/seed.mjs); all have doctors. */
export const ROUTING_EVAL_SPECIALTIES = [
  {
    name: "Family Medicine",
    routingHints:
      "General check-ups, common illnesses like colds, fever, cough, minor injuries, health certificates, unsure where to start",
  },
  {
    name: "Internal Medicine",
    routingHints:
      "Adults with long-term conditions like diabetes or high blood pressure, follow-ups, lab result review, ongoing body aches, stomach problems",
  },
  {
    name: "Pediatrics",
    routingHints:
      "Patients under 18: check-ups, vaccinations, fever, cough, growth and development",
  },
  {
    name: "Cardiology",
    routingHints:
      "Heart concerns: palpitations, high blood pressure that's hard to control, follow-up after a heart test, referred by another doctor for the heart",
  },
];

export type RoutingEvalCase = {
  message: string;
  language: "en" | "tl" | "taglish";
  expected: RoutingEvalExpected;
};

const specialty = (...names: string[]): RoutingEvalExpected => ({ kind: "specialty", names });
const EMERGENCY: RoutingEvalExpected = { kind: "emergency" };

export const ROUTING_EVAL_CASES: RoutingEvalCase[] = [
  // Spec examples.
  { message: "Ubo't sipon ng anak ko, 4 years old, 3 days na", language: "taglish", expected: specialty("Pediatrics") },
  { message: "Pa-check up po ako, mataas BP ko lagi", language: "taglish", expected: specialty("Internal Medicine", "Cardiology") },
  { message: "Kumakabog dibdib ko minsan kahit nakaupo", language: "tl", expected: specialty("Cardiology") },
  { message: "Masakit dibdib ko ngayon, hirap huminga", language: "tl", expected: EMERGENCY },
  { message: "I don't know, I just feel tired all the time", language: "en", expected: specialty("Family Medicine") },
  { message: "Need ko magpa-CBC, may request na ako", language: "taglish", expected: { kind: "service", name: "CBC" } },

  // English.
  { message: "My 5-year-old has had a cough for a week, can we see a doctor?", language: "en", expected: specialty("Pediatrics") },
  { message: "I keep getting palpitations and want to have it checked", language: "en", expected: specialty("Cardiology") },
  { message: "I need a follow-up for my blood pressure", language: "en", expected: specialty("Internal Medicine", "Cardiology") },
  { message: "I'm 67 and I'd like a check-up for my diabetes", language: "en", expected: specialty("Internal Medicine") },
  { message: "I need a medical certificate for my new job", language: "en", expected: specialty("Family Medicine") },
  { message: "My baby is due for her vaccines", language: "en", expected: specialty("Pediatrics") },
  { message: "I've had a fever and colds since yesterday, I'd like to see a doctor", language: "en", expected: specialty("Family Medicine") },
  { message: "My doctor told me to see someone about my heart after my ECG", language: "en", expected: specialty("Cardiology") },
  { message: "My stomach has been hurting on and off for weeks, I want it checked", language: "en", expected: specialty("Internal Medicine") },
  { message: "I just want a general check-up", language: "en", expected: specialty("Family Medicine") },
  { message: "My teenage daughter, she's 15, keeps getting stomach aches", language: "en", expected: specialty("Pediatrics") },
  { message: "I was referred by my doctor to a heart specialist", language: "en", expected: specialty("Cardiology") },
  { message: "My grandmother needs a check-up for her heart and her sugar", language: "en", expected: specialty("Internal Medicine", "Cardiology") },
  { message: "My father fainted and is not waking up", language: "en", expected: EMERGENCY },
  { message: "I'm bleeding a lot from a cut and it won't stop", language: "en", expected: EMERGENCY },
  { message: "I want to end my life", language: "en", expected: EMERGENCY },
  { message: "My son is having a seizure right now", language: "en", expected: EMERGENCY },

  // Tagalog.
  { message: "Lagi akong nahihilo at pagod, gusto ko magpatingin", language: "tl", expected: specialty("Family Medicine", "Internal Medicine") },
  { message: "May lagnat at ubo ang anak ko, walong taong gulang siya", language: "tl", expected: specialty("Pediatrics") },
  { message: "Gusto ko magpatingin, palaging masakit ang katawan ko", language: "tl", expected: specialty("Internal Medicine", "Family Medicine") },
  { message: "Mabilis ang tibok ng puso ko kahit nagpapahinga", language: "tl", expected: specialty("Cardiology") },
  { message: "Hindi makahinga ang tatay ko ngayon", language: "tl", expected: EMERGENCY },
  { message: "Nawalan ng malay ang lola ko", language: "tl", expected: EMERGENCY },
  { message: "Kailangan ko ng medical certificate para sa trabaho", language: "tl", expected: specialty("Family Medicine") },
  { message: "May maliit na sugat ako sa paa, gusto ko lang ipatingin", language: "tl", expected: specialty("Family Medicine") },
  { message: "Hindi ko alam kung saan ako dapat magpatingin", language: "tl", expected: specialty("Family Medicine") },
  { message: "Sinisipon ako at may konting lagnat, pwede ba magpa-check up?", language: "tl", expected: specialty("Family Medicine") },
  { message: "Parang na-stroke si mama, hindi siya makapagsalita nang maayos", language: "tl", expected: EMERGENCY },

  // Taglish.
  { message: "Pa-follow up po sa diabetes ko", language: "taglish", expected: specialty("Internal Medicine") },
  { message: "Pa-check up lang po, wala namang masakit", language: "taglish", expected: specialty("Family Medicine") },
  { message: "Bakuna po para sa baby ko, 1 year old", language: "taglish", expected: specialty("Pediatrics") },
  { message: "Pa-review po ng lab results ko", language: "taglish", expected: specialty("Internal Medicine") },
  { message: "Mataas BP ko kahit may maintenance na, hirap i-control", language: "taglish", expected: specialty("Cardiology", "Internal Medicine") },
  { message: "Masakit ulo ko, 2 days na, pa-check up po", language: "taglish", expected: specialty("Family Medicine", "Internal Medicine") },
];
