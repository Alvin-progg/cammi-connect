import { describe, expect, it } from "vitest";

import { requirementFormSchema, supersedeRequirementSchema } from "@/lib/requirements/schemas";

const SERVICE_ID = "00000000-0000-4000-8000-000000000801";
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000201";

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

const VALID = {
  title: "Valid ID",
  description: "",
  target: `service:${SERVICE_ID}`,
  isMandatory: "on",
  effectiveFrom: "2026-11-05",
  effectiveTo: "",
};

describe("requirementFormSchema", () => {
  it("parses a service requirement, trimming text and nulling blanks", () => {
    expect(requirementFormSchema.parse({ ...VALID, title: "  Valid ID " })).toEqual({
      title: "Valid ID",
      description: null,
      target: { kind: "service", id: SERVICE_ID },
      isMandatory: true,
      effectiveFrom: "2026-11-05",
      effectiveTo: null,
    });
  });

  it("parses a specialty target and an end date", () => {
    expect(
      requirementFormSchema.parse({
        ...VALID,
        target: `specialty:${SPECIALTY_ID}`,
        effectiveTo: "2026-12-31",
      }),
    ).toMatchObject({
      target: { kind: "specialty", id: SPECIALTY_ID },
      effectiveTo: "2026-12-31",
    });
  });

  it("reads a missing checkbox as optional", () => {
    expect(requirementFormSchema.parse({ ...VALID, isMandatory: null }).isMandatory).toBe(false);
  });

  it.each([
    ["", "Enter a requirement title."],
    ["x".repeat(151), "Keep the title under 150 characters."],
  ])("rejects the title %j", (title, message) => {
    expect(firstMessage(requirementFormSchema.safeParse({ ...VALID, title }))).toBe(message);
  });

  it.each(["", "service", `doctor:${SERVICE_ID}`, "service:nope", `service:${SERVICE_ID}:x`])(
    "rejects the target %j",
    (target) => {
      expect(firstMessage(requirementFormSchema.safeParse({ ...VALID, target }))).toBe(
        "Choose a service or specialty.",
      );
    },
  );

  it("requires a valid start date", () => {
    expect(firstMessage(requirementFormSchema.safeParse({ ...VALID, effectiveFrom: "" }))).toBe(
      "Enter a valid start date.",
    );
  });

  it("rejects an end date before the start date, but allows the same day", () => {
    expect(
      firstMessage(requirementFormSchema.safeParse({ ...VALID, effectiveTo: "2026-11-04" })),
    ).toBe("The end date can't be before the start date.");
    expect(requirementFormSchema.safeParse({ ...VALID, effectiveTo: "2026-11-05" }).success).toBe(
      true,
    );
  });
});

describe("supersedeRequirementSchema", () => {
  it("requires a valid start date for the new version", () => {
    expect(supersedeRequirementSchema.parse({ startsOn: "2027-01-01" })).toEqual({
      startsOn: "2027-01-01",
    });
    expect(firstMessage(supersedeRequirementSchema.safeParse({ startsOn: "" }))).toBe(
      "Enter the date the new version starts.",
    );
  });
});
