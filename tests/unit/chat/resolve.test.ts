// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  BOOKING_HORIZON_DAYS,
  filterSlotsByTime,
  matchDoctorsByName,
  matchSpecialtiesByName,
  resolvePreferredDate,
} from "@/lib/chat/resolve";

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

describe("matchSpecialtiesByName", () => {
  const SPECIALTIES = [
    { id: "s1", name: "General Pediatrics" },
    { id: "s2", name: "Pediatric Cardiology" },
    { id: "s3", name: "Dermatology" },
  ];

  it("prefers an exact name match", () => {
    expect(matchSpecialtiesByName("general pediatrics", SPECIALTIES).map((s) => s.id)).toEqual([
      "s1",
    ]);
  });

  it("matches a partial name or a word stem", () => {
    expect(matchSpecialtiesByName("derma", SPECIALTIES).map((s) => s.id)).toEqual(["s3"]);
    expect(matchSpecialtiesByName("pediatric", SPECIALTIES).map((s) => s.id)).toEqual([
      "s1",
      "s2",
    ]);
  });

  it("returns nothing for an unknown or blank name", () => {
    expect(matchSpecialtiesByName("Neurosurgery", SPECIALTIES)).toEqual([]);
    expect(matchSpecialtiesByName("  ", SPECIALTIES)).toEqual([]);
  });
});

describe("resolvePreferredDate", () => {
  // 2026-10-31 09:00 in Manila.
  const NOW = new Date("2026-10-31T01:00:00Z");

  it("accepts today and dates up to the booking horizon", () => {
    expect(resolvePreferredDate("2026-10-31", NOW)).toEqual({ status: "ok", date: "2026-10-31" });
    expect(resolvePreferredDate("2026-12-30", NOW)).toEqual({ status: "ok", date: "2026-12-30" });
  });

  it("rejects past dates", () => {
    expect(resolvePreferredDate("2026-10-30", NOW)).toEqual({ status: "past" });
  });

  it(`rejects dates more than ${BOOKING_HORIZON_DAYS} days ahead`, () => {
    expect(resolvePreferredDate("2026-12-31", NOW)).toEqual({ status: "beyond_horizon" });
  });

  it("uses the Manila date, not the UTC date", () => {
    // 2026-10-31 23:30 UTC is already 1 November in Manila.
    const lateUtc = new Date("2026-10-31T23:30:00Z");
    expect(resolvePreferredDate("2026-10-31", lateUtc)).toEqual({ status: "past" });
  });

  it("reports anything that is not a real date as invalid", () => {
    expect(resolvePreferredDate("next Monday", NOW)).toEqual({ status: "invalid" });
    expect(resolvePreferredDate("2026-02-30", NOW)).toEqual({ status: "invalid" });
  });
});

describe("filterSlotsByTime", () => {
  // Manila times: 08:00, 11:30, 13:00, 17:30.
  const SLOTS = [
    { start: "2026-11-03T00:00:00.000Z", end: "2026-11-03T00:30:00.000Z" },
    { start: "2026-11-03T03:30:00.000Z", end: "2026-11-03T04:00:00.000Z" },
    { start: "2026-11-03T05:00:00.000Z", end: "2026-11-03T05:30:00.000Z" },
    { start: "2026-11-03T09:30:00.000Z", end: "2026-11-03T10:00:00.000Z" },
  ];
  const startsOf = (slots: typeof SLOTS) => slots.map((slot) => slot.start);

  it("keeps morning, afternoon, or evening slots in Manila time", () => {
    expect(startsOf(filterSlotsByTime(SLOTS, "morning"))).toEqual([SLOTS[0].start, SLOTS[1].start]);
    expect(startsOf(filterSlotsByTime(SLOTS, "in the afternoon"))).toEqual([SLOTS[2].start]);
    expect(startsOf(filterSlotsByTime(SLOTS, "Evening"))).toEqual([SLOTS[3].start]);
  });

  it("keeps slots at or after a clock time", () => {
    expect(startsOf(filterSlotsByTime(SLOTS, "1pm"))).toEqual([SLOTS[2].start, SLOTS[3].start]);
    expect(startsOf(filterSlotsByTime(SLOTS, "11:30"))).toEqual([
      SLOTS[1].start,
      SLOTS[2].start,
      SLOTS[3].start,
    ]);
    expect(startsOf(filterSlotsByTime(SLOTS, "12 am"))).toEqual(startsOf(SLOTS));
  });

  it("does not filter when the time cannot be understood", () => {
    expect(filterSlotsByTime(SLOTS, "whenever works")).toEqual(SLOTS);
    expect(filterSlotsByTime(SLOTS, "25:00")).toEqual(SLOTS);
    expect(filterSlotsByTime(SLOTS, undefined)).toEqual(SLOTS);
  });
});
