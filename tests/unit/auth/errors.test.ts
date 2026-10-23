// @vitest-environment node
import { describe, expect, it } from "vitest";
import { messageForAuthError } from "@/lib/auth/errors";

describe("messageForAuthError", () => {
  it.each([
    ["invalid_credentials", "Email or password is incorrect."],
    ["email_not_confirmed", "Confirm your email first."],
    [
      "user_already_exists",
      "If an account can be created for this email, check your inbox.",
    ],
    ["weak_password", "Password does not meet the requirements."],
    ["over_email_send_rate_limit", "Too many attempts, try again later."],
    ["over_request_rate_limit", "Too many attempts, try again later."],
  ])("maps the provider code %s to a user-safe message", (code, message) => {
    expect(messageForAuthError(code)).toBe(message);
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(messageForAuthError("unknown_code")).toBe("Unable to sign in right now.");
  });

  it("falls back to a generic message when the code is missing", () => {
    expect(messageForAuthError(undefined)).toBe("Unable to sign in right now.");
    expect(messageForAuthError(null)).toBe("Unable to sign in right now.");
  });
});
