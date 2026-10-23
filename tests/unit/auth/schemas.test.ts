// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loginSchema, registerSchema } from "@/lib/auth/schemas";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "pat@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable: parse should fail");
    expect(z.flattenError(result.error).fieldErrors.email).toBeTruthy();
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({
      email: "pat@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable: parse should fail");
    expect(z.flattenError(result.error).fieldErrors.password).toBeTruthy();
  });
});

describe("registerSchema", () => {
  const valid = {
    fullName: "Pat Doe",
    email: "pat@example.com",
    password: "secret123",
    confirmPassword: "secret123",
  };

  it("accepts valid registration input", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable: parse should fail");
    expect(z.flattenError(result.error).fieldErrors.password).toBeTruthy();
  });

  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable: parse should fail");
    expect(
      result.error.issues.some((issue) => issue.path.includes("confirmPassword")),
    ).toBe(true);
  });

  it("rejects a missing full name", () => {
    const result = registerSchema.safeParse({ ...valid, fullName: "" });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable: parse should fail");
    expect(z.flattenError(result.error).fieldErrors.fullName).toBeTruthy();
  });
});
