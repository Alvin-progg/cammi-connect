// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatClockTime,
  formatManilaDate,
  formatManilaMediumDate,
  formatManilaTime,
} from "@/lib/appointments/format";

describe("formatManilaDate", () => {
  it("formats a Manila calendar date for the page heading", () => {
    expect(formatManilaDate("2026-10-25")).toBe("Sunday, October 25, 2026");
  });
});

describe("formatManilaTime", () => {
  it("formats an instant in Asia/Manila", () => {
    expect(formatManilaTime("2026-10-25T01:00:00.000Z")).toBe("9:00 AM");
  });
});

describe("formatManilaMediumDate", () => {
  it("formats a Manila calendar date compactly", () => {
    expect(formatManilaMediumDate("2026-12-31")).toBe("Dec 31, 2026");
  });
});

describe("formatClockTime", () => {
  it("formats a 24-hour wall-clock time as 12-hour", () => {
    expect(formatClockTime("08:00")).toBe("8:00 AM");
    expect(formatClockTime("13:30")).toBe("1:30 PM");
    expect(formatClockTime("00:00")).toBe("12:00 AM");
  });
});
