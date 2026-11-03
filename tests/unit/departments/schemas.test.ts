import { describe, expect, it } from "vitest";

import { departmentFormSchema } from "@/lib/departments/schemas";

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("departmentFormSchema", () => {
  it("trims values, upper-cases the code, and nulls a blank description", () => {
    expect(
      departmentFormSchema.parse({ name: "  Cardiology ", code: " card ", description: "" }),
    ).toEqual({ name: "Cardiology", code: "CARD", description: null });
  });

  it("requires a name of at most 100 characters", () => {
    expect(firstMessage(departmentFormSchema.safeParse({ name: " ", code: "CARD" }))).toBe(
      "Enter a department name.",
    );
    expect(
      firstMessage(departmentFormSchema.safeParse({ name: "x".repeat(101), code: "CARD" })),
    ).toBe("Keep the name under 100 characters.");
  });

  it("requires a short code", () => {
    expect(
      firstMessage(departmentFormSchema.safeParse({ name: "Cardiology", code: "CARDIOLOGY-OPD" })),
    ).toBe("Keep the code to 10 characters or fewer.");
  });

  it("has no active flag: status changes are a separate action", () => {
    expect(
      departmentFormSchema.parse({ name: "Cardiology", code: "CARD", isActive: false }),
    ).not.toHaveProperty("isActive");
  });
});
