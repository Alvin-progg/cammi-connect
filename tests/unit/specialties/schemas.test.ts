import { describe, expect, it } from "vitest";

import { specialtyFormSchema } from "@/lib/specialties/schemas";

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("specialtyFormSchema", () => {
  it("trims the name and nulls a blank description", () => {
    expect(specialtyFormSchema.parse({ name: "  Pediatric Cardiology ", description: " " })).toEqual({
      name: "Pediatric Cardiology",
      description: null,
    });
  });

  it("requires a name of at most 100 characters", () => {
    expect(firstMessage(specialtyFormSchema.safeParse({ name: "" }))).toBe("Enter a specialty name.");
    expect(firstMessage(specialtyFormSchema.safeParse({ name: "x".repeat(101) }))).toBe(
      "Keep the name under 100 characters.",
    );
  });

  it("has no active flag: status changes are a separate action", () => {
    expect(specialtyFormSchema.parse({ name: "Cardiology", isActive: false })).not.toHaveProperty(
      "isActive",
    );
  });
});
