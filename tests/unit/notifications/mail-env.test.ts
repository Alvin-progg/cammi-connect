// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const MAIL_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "APP_BASE_URL"];

async function loadConfig() {
  vi.resetModules();
  return import("@/server/config");
}

describe("getMailEnv", () => {
  beforeEach(() => {
    for (const key of MAIL_KEYS) vi.stubEnv(key, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when SMTP is not configured, so email stays off", async () => {
    const { getMailEnv } = await loadConfig();

    expect(getMailEnv()).toBeNull();
  });

  it("reads the full configuration with the default port", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_USER", "mailer");
    vi.stubEnv("SMTP_PASS", "smtp-secret-value");
    vi.stubEnv("MAIL_FROM", "CamiConnect <no-reply@example.test>");
    vi.stubEnv("APP_BASE_URL", "https://cami.example.test/");
    const { getMailEnv } = await loadConfig();

    expect(getMailEnv()).toEqual({
      smtpHost: "smtp.example.test",
      smtpPort: 587,
      smtpUser: "mailer",
      smtpPass: "smtp-secret-value",
      mailFrom: "CamiConnect <no-reply@example.test>",
      appBaseUrl: "https://cami.example.test",
    });
  });

  it("names the missing variables without printing any value", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_PASS", "smtp-secret-value");
    const { getMailEnv } = await loadConfig();

    expect(() => getMailEnv()).toThrow(/SMTP_USER/);
    expect(() => getMailEnv()).toThrow(/MAIL_FROM/);
    expect(() => getMailEnv()).not.toThrow(/smtp-secret-value/);
  });
});
