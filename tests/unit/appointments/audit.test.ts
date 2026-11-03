import { describe, expect, it } from "vitest";

import {
  auditActionFor,
  scheduledAtFromAuditValues,
} from "@/lib/appointments/audit";

describe("auditActionFor (FD-001 appointment_audit_logs.action)", () => {
  it("records the first entry of an appointment as created", () => {
    expect(auditActionFor(null, "requested")).toBe("created");
  });

  it("records an unchanged status as a reschedule", () => {
    expect(auditActionFor("confirmed", "confirmed")).toBe("rescheduled");
    expect(auditActionFor("requested", "requested")).toBe("rescheduled");
  });

  it.each([
    ["requested", "confirmed", "confirmed"],
    ["requested", "rejected", "rejected"],
    ["requested", "cancelled", "cancelled"],
    ["confirmed", "checked_in", "checked_in"],
    ["confirmed", "no_show", "no_show"],
    ["checked_in", "completed", "completed"],
  ] as const)("records %s → %s as %s", (from, to, action) => {
    expect(auditActionFor(from, to)).toBe(action);
  });

  it("refuses a creation entry with any status other than requested", () => {
    expect(() => auditActionFor(null, "confirmed")).toThrow(
      "An appointment must be created as requested.",
    );
  });

  it("refuses a change back to requested", () => {
    expect(() => auditActionFor("confirmed", "requested")).toThrow(
      "An appointment cannot return to requested.",
    );
  });
});

describe("scheduledAtFromAuditValues", () => {
  it("reads the schedule snapshot from an audit row's values", () => {
    expect(
      scheduledAtFromAuditValues({ scheduled_at: "2026-11-03T01:00:00.000Z" }),
    ).toBe("2026-11-03T01:00:00.000Z");
  });

  it.each([null, "2026-11-03", [], {}, { scheduled_at: 42 }])(
    "returns null for values without a string snapshot (%j)",
    (values) => {
      expect(scheduledAtFromAuditValues(values)).toBeNull();
    },
  );
});
