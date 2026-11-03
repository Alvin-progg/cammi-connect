import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUSES } from "@/lib/appointments/status";
import {
  DOCTOR_APPOINTMENT_ACTIONS,
  PATIENT_CANCEL_SOURCES,
  allowedDoctorActions,
  allowedTransitionsFrom,
  canTransition,
  canPatientCancel,
  canDoctorPerform,
  isDoctorAppointmentAction,
  sourceStatusesForAction,
  targetStatusForAction,
} from "@/lib/appointments/transitions";

describe("doctor appointment transition matrix (ADR-0007, amended)", () => {
  it("allows only cancel from requested; front desk staff confirm (FD-001 PR 4)", () => {
    expect(allowedDoctorActions("requested")).toEqual(["cancel"]);
    expect(canDoctorPerform("requested", "cancel")).toBe(true);
    expect(canDoctorPerform("requested", "complete")).toBe(false);
    expect(canDoctorPerform("requested", "no_show")).toBe(false);
  });

  it("allows complete, no-show, and cancel from confirmed", () => {
    expect(canDoctorPerform("confirmed", "complete")).toBe(true);
    expect(canDoctorPerform("confirmed", "no_show")).toBe(true);
    expect(canDoctorPerform("confirmed", "cancel")).toBe(true);
    expect(allowedDoctorActions("confirmed")).toEqual(["complete", "no_show", "cancel"]);
  });

  it("allows no actions from terminal statuses", () => {
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      expect(allowedDoctorActions(status)).toEqual([]);
    }
  });

  it("maps actions to their target statuses", () => {
    expect(targetStatusForAction("complete")).toBe("completed");
    expect(targetStatusForAction("no_show")).toBe("no_show");
    expect(targetStatusForAction("cancel")).toBe("cancelled");
  });

  it("exposes the source statuses used for guarded writes", () => {
    expect(sourceStatusesForAction("complete")).toEqual(["confirmed"]);
    expect(sourceStatusesForAction("cancel")).toEqual([
      "requested",
      "confirmed",
    ]);
  });

  it("validates action names", () => {
    expect(isDoctorAppointmentAction("complete")).toBe(true);
    expect(isDoctorAppointmentAction("delete")).toBe(false);
  });

  it("does not offer confirm to doctors (FD-001 PR 4)", () => {
    expect(isDoctorAppointmentAction("confirm")).toBe(false);
    expect(DOCTOR_APPOINTMENT_ACTIONS).not.toContain("confirm");
  });
});

describe("patient cancellation (ADR-0007, AI-APT-001)", () => {
  it("allows patients to cancel requested and confirmed appointments only", () => {
    expect(PATIENT_CANCEL_SOURCES).toEqual(["requested", "confirmed"]);
    expect(canPatientCancel("requested")).toBe(true);
    expect(canPatientCancel("confirmed")).toBe(true);
    expect(canPatientCancel("completed")).toBe(false);
    expect(canPatientCancel("cancelled")).toBe(false);
    expect(canPatientCancel("no_show")).toBe(false);
  });
});

describe("appointment status lifecycle (SPEC-frontdesk §11, FD-001)", () => {
  // Every allowed from→to pair. Any pair not listed must be rejected.
  // confirmed→completed is kept from ADR-0007 so doctors can still complete
  // a visit that was never checked in.
  const ALLOWED: ReadonlyArray<readonly [string, string]> = [
    ["requested", "confirmed"],
    ["requested", "rejected"],
    ["requested", "cancelled"],
    ["confirmed", "checked_in"],
    ["confirmed", "cancelled"],
    ["confirmed", "no_show"],
    ["confirmed", "completed"],
    ["checked_in", "completed"],
  ];

  const allPairs = APPOINTMENT_STATUSES.flatMap((from) =>
    APPOINTMENT_STATUSES.map((to) => [from, to] as const),
  );

  it.each(allPairs)("%s → %s follows the transition matrix", (from, to) => {
    const expected = ALLOWED.some(
      ([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === to,
    );
    expect(canTransition(from, to)).toBe(expected);
  });

  it("covers all seven lifecycle statuses", () => {
    expect([...APPOINTMENT_STATUSES].sort()).toEqual(
      [
        "cancelled",
        "checked_in",
        "completed",
        "confirmed",
        "no_show",
        "rejected",
        "requested",
      ].sort(),
    );
  });

  it("has no exits from terminal statuses", () => {
    for (const status of ["rejected", "cancelled", "completed", "no_show"] as const) {
      expect(allowedTransitionsFrom(status)).toEqual([]);
    }
  });

  it("only offers doctor actions the lifecycle allows", () => {
    for (const action of DOCTOR_APPOINTMENT_ACTIONS) {
      for (const source of sourceStatusesForAction(action)) {
        expect(canTransition(source, targetStatusForAction(action))).toBe(true);
      }
    }
  });

  it("only lets patients cancel where the lifecycle allows it", () => {
    for (const source of PATIENT_CANCEL_SOURCES) {
      expect(canTransition(source, "cancelled")).toBe(true);
    }
  });
});
