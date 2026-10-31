// @vitest-environment node
import { describe, expect, it } from "vitest";

import { matchDoctorsByName } from "@/lib/chat/resolve";

const DOCTORS = [
  { id: "d1", fullName: "Maya Santos" },
  { id: "d2", fullName: "Paolo Reyes" },
  { id: "d3", fullName: "José Santos" },
];

describe("matchDoctorsByName", () => {
  it("matches a full name regardless of case and a leading title", () => {
    expect(matchDoctorsByName("dr. maya santos", DOCTORS).map((d) => d.id)).toEqual(["d1"]);
    expect(matchDoctorsByName("Doctor Paolo Reyes", DOCTORS).map((d) => d.id)).toEqual(["d2"]);
  });

  it("ignores accents", () => {
    expect(matchDoctorsByName("Jose Santos", DOCTORS).map((d) => d.id)).toEqual(["d3"]);
  });

  it("returns every doctor sharing a partial name", () => {
    expect(matchDoctorsByName("Dr. Santos", DOCTORS).map((d) => d.id)).toEqual(["d1", "d3"]);
  });

  it("returns nothing for an unknown or blank name", () => {
    expect(matchDoctorsByName("Dr. House", DOCTORS)).toEqual([]);
    expect(matchDoctorsByName("Dr.", DOCTORS)).toEqual([]);
  });
});
