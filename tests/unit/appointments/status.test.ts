import { describe, expect, it } from "vitest";

import {
  APPOINTMENT_STATUS_LABELS,
  BOOKING_SOURCES,
  SLOT_HOLDING_STATUSES,
  isAppointmentStatus,
  isBookingSource,
} from "@/lib/appointments/status";

describe("appointment status vocabulary (FD-001)", () => {
  it("shows a requested appointment as pending confirmation", () => {
    expect(APPOINTMENT_STATUS_LABELS.requested).toBe("Pending confirmation");
  });

  it("labels the front-desk statuses", () => {
    expect(APPOINTMENT_STATUS_LABELS.rejected).toBe("Rejected");
    expect(APPOINTMENT_STATUS_LABELS.checked_in).toBe("Checked in");
    expect(isAppointmentStatus("rejected")).toBe(true);
    expect(isAppointmentStatus("checked_in")).toBe(true);
    expect(isAppointmentStatus("pending_confirmation")).toBe(false);
  });
});

describe("slot-holding statuses", () => {
  // Must match the appointments_no_active_overlap predicate in migration 0007.
  it("holds the slot while pending, confirmed, or checked in", () => {
    expect(SLOT_HOLDING_STATUSES).toEqual(["requested", "confirmed", "checked_in"]);
  });
});

describe("booking sources (SPEC-frontdesk §10)", () => {
  it("lists the supported booking sources", () => {
    expect(BOOKING_SOURCES).toEqual(["ai_chatbot", "front_desk", "other"]);
  });

  it("validates booking source values", () => {
    expect(isBookingSource("ai_chatbot")).toBe(true);
    expect(isBookingSource("front_desk")).toBe(true);
    expect(isBookingSource("walk_in")).toBe(false);
  });
});
