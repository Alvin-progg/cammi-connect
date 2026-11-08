import { describe, expect, it } from "vitest";

import { formatMonthRange, isSmallSample } from "@/lib/analytics/display";

describe("formatMonthRange", () => {
  it("labels outcome months like the reference", () => {
    expect(formatMonthRange("2026-01", "2026-06")).toBe("Jan–Jun");
    expect(formatMonthRange("2026-11", "2026-11")).toBe("Nov");
    expect(formatMonthRange("2025-12", "2026-01")).toBe("Dec 2025–Jan 2026");
  });
});

describe("isSmallSample", () => {
  it("flags rates over fewer than ten finished visits, but not zero", () => {
    expect(isSmallSample(0)).toBe(false);
    expect(isSmallSample(9)).toBe(true);
    expect(isSmallSample(10)).toBe(false);
  });
});
