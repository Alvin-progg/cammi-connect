// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sanitizeReturnPath } from "@/lib/auth/return-path";

describe("sanitizeReturnPath", () => {
  it.each(["/account", "/appointments", "/account?tab=upcoming", "/login"])(
    "accepts the same-origin relative path %s",
    (value) => {
      expect(sanitizeReturnPath(value)).toBe(value);
    },
  );

  it.each([
    "//evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "\\evil.example",
    "/\\/evil.example",
    "evil.example",
    "",
  ])("rejects the open-redirect candidate %j", (value) => {
    expect(sanitizeReturnPath(value)).toBe("");
  });

  it("rejects null and undefined", () => {
    expect(sanitizeReturnPath(null)).toBe("");
    expect(sanitizeReturnPath(undefined)).toBe("");
  });
});
