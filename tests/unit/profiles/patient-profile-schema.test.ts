import { describe, expect, it } from "vitest";

import { updatePatientProfileSchema } from "@/lib/profiles/schemas";

describe("updatePatientProfileSchema", () => {
  it("trims the name and accepts an empty phone", () => {
    const result = updatePatientProfileSchema.safeParse({ fullName: "  Maria Santos ", phone: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ fullName: "Maria Santos", phone: "" });
    }
  });

  it("rejects a name shorter than two characters", () => {
    const result = updatePatientProfileSchema.safeParse({ fullName: "M", phone: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a phone number with letters", () => {
    const result = updatePatientProfileSchema.safeParse({ fullName: "Maria Santos", phone: "call me" });
    expect(result.success).toBe(false);
  });

  it("ignores fields outside the patient self-service set", () => {
    const result = updatePatientProfileSchema.safeParse({
      fullName: "Maria Santos",
      phone: "",
      role: "admin",
      is_active: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("role");
      expect(result.data).not.toHaveProperty("is_active");
    }
  });
});
