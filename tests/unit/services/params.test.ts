import { describe, expect, it } from "vitest";

import { parseServiceStatusFilter } from "@/lib/services/params";

describe("parseServiceStatusFilter", () => {
  it.each([
    ["active", "active"],
    ["inactive", "inactive"],
    ["all", "all"],
    [undefined, "all"],
    ["bogus", "all"],
    [["inactive", "active"], "inactive"],
  ] as const)("parses %j as %s", (value, expected) => {
    expect(parseServiceStatusFilter(value as string | string[] | undefined)).toBe(expected);
  });
});
