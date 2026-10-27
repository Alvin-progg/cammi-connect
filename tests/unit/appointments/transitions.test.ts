import { describe, expect, it } from "vitest";

import {
  allowedDoctorActions,
  canDoctorPerform,
  isDoctorAppointmentAction,
  sourceStatusesForAction,
  targetStatusForAction,
} from "@/lib/appointments/transitions";

describe("doctor appointment transition matrix (ADR-0007, amended)", () => {
  it("allows confirm and cancel from requested", () => {
    expect(canDoctorPerform("requested", "confirm")).toBe(true);
    expect(canDoctorPerform("requested", "cancel")).toBe(true);
    expect(canDoctorPerform("requested", "complete")).toBe(false);
    expect(canDoctorPerform("requested", "no_show")).toBe(false);
  });

  it("allows complete, no-show, and cancel from confirmed", () => {
    expect(canDoctorPerform("confirmed", "complete")).toBe(true);
    expect(canDoctorPerform("confirmed", "no_show")).toBe(true);
    expect(canDoctorPerform("confirmed", "cancel")).toBe(true);
    expect(canDoctorPerform("confirmed", "confirm")).toBe(false);
  });

  it("allows no actions from terminal statuses", () => {
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      expect(allowedDoctorActions(status)).toEqual([]);
    }
  });

  it("maps actions to their target statuses", () => {
    expect(targetStatusForAction("confirm")).toBe("confirmed");
    expect(targetStatusForAction("complete")).toBe("completed");
    expect(targetStatusForAction("no_show")).toBe("no_show");
    expect(targetStatusForAction("cancel")).toBe("cancelled");
  });

  it("exposes the source statuses used for guarded writes", () => {
    expect(sourceStatusesForAction("confirm")).toEqual(["requested"]);
    expect(sourceStatusesForAction("cancel")).toEqual([
      "requested",
      "confirmed",
    ]);
  });

  it("validates action names", () => {
    expect(isDoctorAppointmentAction("confirm")).toBe(true);
    expect(isDoctorAppointmentAction("delete")).toBe(false);
  });
});
