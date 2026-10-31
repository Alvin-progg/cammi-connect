import { describe, expect, it } from "vitest";

import { splitPatientAppointments } from "@/lib/appointments/patient";
import type { PatientAppointment } from "@/lib/appointments/types";

const NOW = new Date("2026-10-30T02:00:00Z");

function appointment(
  id: string,
  scheduledAt: string,
  status: PatientAppointment["status"],
): PatientAppointment {
  return {
    id,
    doctorName: "Dr. Maya Santos",
    departmentName: "Cardiology",
    reason: null,
    scheduledAt,
    durationMinutes: 30,
    status,
  };
}

describe("splitPatientAppointments", () => {
  it("puts future requested and confirmed visits under upcoming, soonest first", () => {
    const later = appointment("later", "2026-11-05T01:00:00Z", "confirmed");
    const sooner = appointment("sooner", "2026-10-31T01:00:00Z", "requested");

    const { upcoming, past } = splitPatientAppointments([later, sooner], NOW);

    expect(upcoming.map((item) => item.id)).toEqual(["sooner", "later"]);
    expect(past).toEqual([]);
  });

  it("puts past, cancelled, completed, and no-show visits under past, newest first", () => {
    const old = appointment("old", "2026-10-01T01:00:00Z", "completed");
    const recent = appointment("recent", "2026-10-29T01:00:00Z", "no_show");
    const cancelledFuture = appointment("cancelled-future", "2026-11-10T01:00:00Z", "cancelled");
    const missedRequest = appointment("missed-request", "2026-10-30T01:00:00Z", "requested");

    const { upcoming, past } = splitPatientAppointments(
      [old, recent, cancelledFuture, missedRequest],
      NOW,
    );

    expect(upcoming).toEqual([]);
    expect(past.map((item) => item.id)).toEqual([
      "cancelled-future",
      "missed-request",
      "recent",
      "old",
    ]);
  });

  it("keeps a visit starting right now under upcoming", () => {
    const now = appointment("now", NOW.toISOString(), "confirmed");

    expect(splitPatientAppointments([now], NOW).upcoming).toEqual([now]);
  });
});
