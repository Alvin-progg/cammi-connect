import { describe, expect, it } from "vitest";

import { hmoProviderFormSchema } from "@/lib/hmo-providers/schemas";

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("hmoProviderFormSchema (PAY-01)", () => {
  it("trims the name, reads the co-pay in pesos as centavos, and nulls blank notes", () => {
    expect(hmoProviderFormSchema.parse({ name: " Maxicare ", copayCentavos: "150.50", notes: " " })).toEqual({
      name: "Maxicare",
      copayCentavos: 15050,
      notes: null,
    });
  });

  it("treats a blank co-pay as none", () => {
    expect(hmoProviderFormSchema.parse({ name: "Intellicare", copayCentavos: "" }).copayCentavos).toBe(0);
  });

  it("requires a name of at most 100 characters and notes of at most 500", () => {
    expect(firstMessage(hmoProviderFormSchema.safeParse({ name: " " }))).toBe("Enter the HMO name.");
    expect(firstMessage(hmoProviderFormSchema.safeParse({ name: "x".repeat(101) }))).toBe(
      "Keep the name under 100 characters.",
    );
    expect(
      firstMessage(hmoProviderFormSchema.safeParse({ name: "MediCard", notes: "x".repeat(501) })),
    ).toBe("Keep the notes under 500 characters.");
  });

  it("rejects a negative or malformed co-pay", () => {
    for (const copay of ["-100", "1.999", "free"]) {
      expect(firstMessage(hmoProviderFormSchema.safeParse({ name: "PhilCare", copayCentavos: copay })), copay).toBe(
        "Enter the co-pay in pesos, like 100 or 100.50.",
      );
    }
  });

  it("has no active flag: status changes are a separate action", () => {
    expect(hmoProviderFormSchema.parse({ name: "Maxicare", isActive: false })).not.toHaveProperty(
      "isActive",
    );
  });
});
