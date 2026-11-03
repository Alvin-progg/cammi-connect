import { describe, expect, it } from "vitest";

import { redactSensitive } from "@/lib/audit/redact";

describe("redactSensitive", () => {
  it("removes top-level keys that name a password, token, secret, or key", () => {
    expect(
      redactSensitive({
        name: "Cardiology",
        password: "hunter2",
        access_token: "abc",
        clientSecret: "shh",
        apiKey: "k-123",
      }),
    ).toEqual({ name: "Cardiology" });
  });

  it("matches sensitive key names regardless of case", () => {
    expect(redactSensitive({ PASSWORD: "x", Refresh_Token: "y", code: "CARD" })).toEqual({
      code: "CARD",
    });
  });

  it("removes sensitive keys inside nested objects", () => {
    expect(
      redactSensitive({
        doctor: { fullName: "Dr. Synthetic", credentials: { password: "x", username: "doc" } },
      }),
    ).toEqual({ doctor: { fullName: "Dr. Synthetic", credentials: { username: "doc" } } });
  });

  it("removes sensitive keys from objects inside arrays", () => {
    expect(
      redactSensitive({ items: [{ id: 1, token: "t" }, "plain", 3] }),
    ).toEqual({ items: [{ id: 1 }, "plain", 3] });
  });

  it("keeps null and primitive values unchanged", () => {
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive({ description: null, isActive: false, count: 0 })).toEqual({
      description: null,
      isActive: false,
      count: 0,
    });
  });

  it("does not mutate its input", () => {
    const input = { password: "x", nested: { token: "y" } };
    redactSensitive(input);
    expect(input).toEqual({ password: "x", nested: { token: "y" } });
  });
});
