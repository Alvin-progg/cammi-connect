import { describe, expect, it } from "vitest";

import { isRequirementEffective } from "@/lib/requirements/effective";

const TODAY = "2026-11-05";

describe("isRequirementEffective", () => {
  it.each([
    ["starts today, no end", { effectiveFrom: TODAY, effectiveTo: null }, true],
    ["started earlier, ends today", { effectiveFrom: "2026-01-01", effectiveTo: TODAY }, true],
    ["ended yesterday", { effectiveFrom: "2026-01-01", effectiveTo: "2026-11-04" }, false],
    ["starts tomorrow", { effectiveFrom: "2026-11-06", effectiveTo: null }, false],
    ["open-ended from long ago", { effectiveFrom: "2020-01-01", effectiveTo: null }, true],
  ] as const)("a published requirement that %s → %s", (_label, dates, expected) => {
    expect(isRequirementEffective({ status: "published", ...dates }, TODAY)).toBe(expected);
  });

  it.each(["draft", "archived"] as const)("a %s requirement is never in effect", (status) => {
    expect(
      isRequirementEffective({ status, effectiveFrom: "2026-01-01", effectiveTo: null }, TODAY),
    ).toBe(false);
  });
});
