// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatManilaDate,
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
