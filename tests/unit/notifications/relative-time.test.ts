import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/notifications/relative-time";

const NOW = new Date("2026-11-08T12:00:00.000Z");

describe("formatRelativeTime", () => {
  it("shows minutes under an hour, never zero", () => {
    expect(formatRelativeTime("2026-11-08T11:59:50.000Z", NOW)).toBe("1 min ago");
    expect(formatRelativeTime("2026-11-08T11:15:00.000Z", NOW)).toBe("45 min ago");
  });

  it("shows hours under a day", () => {
    expect(formatRelativeTime("2026-11-08T11:00:00.000Z", NOW)).toBe("1 h ago");
    expect(formatRelativeTime("2026-11-07T18:00:00.000Z", NOW)).toBe("18 h ago");
  });

  it("shows Yesterday between one and two days", () => {
    expect(formatRelativeTime("2026-11-07T10:00:00.000Z", NOW)).toBe("Yesterday");
  });

  it("falls back to the Manila short date after two days", () => {
    expect(formatRelativeTime("2026-11-01T02:00:00.000Z", NOW)).toBe("Sun, Nov 1");
  });
});
