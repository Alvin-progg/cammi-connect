import { describe, expect, it } from "vitest";

import {
  parseRequirementKindFilter,
  parseRequirementStatusFilter,
  parseRequirementTargetParam,
} from "@/lib/requirements/params";

const SERVICE_ID = "00000000-0000-4000-8000-000000000801";

describe("parseRequirementStatusFilter", () => {
  it.each([
    ["draft", "draft"],
    ["published", "published"],
    ["archived", "archived"],
    ["all", "all"],
    [undefined, "all"],
    ["bogus", "all"],
    [["archived", "draft"], "archived"],
  ] as const)("parses %j as %s", (value, expected) => {
    expect(parseRequirementStatusFilter(value as string | string[] | undefined)).toBe(expected);
  });
});

describe("parseRequirementKindFilter", () => {
  it.each([
    ["service", "service"],
    ["specialty", "specialty"],
    [undefined, "all"],
    ["doctor", "all"],
  ] as const)("parses %j as %s", (value, expected) => {
    expect(parseRequirementKindFilter(value)).toBe(expected);
  });
});

describe("parseRequirementTargetParam", () => {
  it("builds the form target from ?service= or ?specialty=", () => {
    expect(parseRequirementTargetParam({ service: SERVICE_ID })).toBe(`service:${SERVICE_ID}`);
    expect(parseRequirementTargetParam({ specialty: SERVICE_ID })).toBe(`specialty:${SERVICE_ID}`);
  });

  it("ignores malformed or missing ids", () => {
    expect(parseRequirementTargetParam({ service: "nope" })).toBeNull();
    expect(parseRequirementTargetParam({})).toBeNull();
  });
});
