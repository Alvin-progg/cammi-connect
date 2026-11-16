import { describe, expect, it } from "vitest";

import {
  DEFAULT_FIRST_CONTACT,
  routeToSpecialty,
  type RoutableSpecialty,
} from "@/lib/chat/routing";

const SPECIALTIES: RoutableSpecialty[] = [
  { id: "fm", name: "Family Medicine", isActive: true, hasActiveDoctors: true },
  { id: "im", name: "Internal Medicine", isActive: true, hasActiveDoctors: true },
  { id: "peds", name: "Pediatrics", isActive: true, hasActiveDoctors: true },
  { id: "card", name: "Cardiology", isActive: true, hasActiveDoctors: true },
  { id: "derm", name: "Dermatology", isActive: false, hasActiveDoctors: true },
  { id: "ent", name: "ENT", isActive: true, hasActiveDoctors: false },
];

describe("routeToSpecialty", () => {
  it("routes a high-confidence match to that specialty", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: ["Cardiology"], routingConfidence: "high" },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "card", reason: "matched" });
  });

  it("matches candidate names case-insensitively", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: [" cardiology "], routingConfidence: "high" },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "card", reason: "matched" });
  });

  it("drops an invented specialty and falls back to first contact", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: ["Cardiac Wizardry"], routingConfidence: "high" },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "fm", reason: "first_contact" });
  });

  it("drops an inactive specialty", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: ["Dermatology"], routingConfidence: "high" },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "fm", reason: "first_contact" });
  });

  it("drops a specialty with no active doctors", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: ["ENT", "Cardiology"], routingConfidence: "high" },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "card", reason: "matched" });
  });

  it("routes a patient under 18 to Pediatrics over the model's candidates", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: ["Cardiology"], routingConfidence: "high", age: 4 },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "peds", reason: "age_rule" });
  });

  it("keeps adults out of the age rule", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: ["Cardiology"], routingConfidence: "high", age: 18 },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "card", reason: "matched" });
  });

  it("lets a specialty the patient named beat routing, even the age rule", () => {
    expect(
      routeToSpecialty(
        {
          specialtyName: "Cardiology",
          specialtyCandidates: ["Family Medicine"],
          routingConfidence: "high",
          age: 10,
        },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "card", reason: "named" });
  });

  it("sends a low-confidence result to the first-contact specialty", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: ["Cardiology"], routingConfidence: "low" },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "fm", reason: "first_contact" });
  });

  it("treats a missing confidence as low", () => {
    expect(
      routeToSpecialty({ specialtyCandidates: ["Cardiology"] }, SPECIALTIES, DEFAULT_FIRST_CONTACT),
    ).toEqual({ specialtyId: "fm", reason: "first_contact" });
  });

  it("routes to the first of two candidates and offers the second", () => {
    expect(
      routeToSpecialty(
        { specialtyCandidates: ["Internal Medicine", "Cardiology"], routingConfidence: "high" },
        SPECIALTIES,
        DEFAULT_FIRST_CONTACT,
      ),
    ).toEqual({ specialtyId: "im", alternativeId: "card", reason: "matched" });
  });

  it("uses the child first-contact specialty for an unclear concern about a child", () => {
    expect(
      routeToSpecialty({ age: 2 }, SPECIALTIES.filter((s) => s.id !== "peds"), {
        adult: "Family Medicine",
        child: "Pediatrics",
      }),
    ).toEqual({ specialtyId: "fm", reason: "first_contact" });
  });

  it("falls back from Family Medicine to Internal Medicine", () => {
    expect(
      routeToSpecialty({}, SPECIALTIES.filter((s) => s.id !== "fm"), DEFAULT_FIRST_CONTACT),
    ).toEqual({ specialtyId: "im", reason: "first_contact" });
  });

  it("uses the admin's first-contact setting", () => {
    expect(
      routeToSpecialty({}, SPECIALTIES, { adult: "Internal Medicine", child: "Pediatrics" }),
    ).toEqual({ specialtyId: "im", reason: "first_contact" });
  });

  it("returns null when no first-contact specialty can be booked", () => {
    expect(
      routeToSpecialty({}, [SPECIALTIES[3]], DEFAULT_FIRST_CONTACT),
    ).toBeNull();
  });
});
