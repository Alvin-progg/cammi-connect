// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

async function headersFor(nodeEnv: string) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example-project.supabase.co");
  vi.resetModules();
  const { default: config } = await import("../../../next.config");
  const rules = (await config.headers?.()) ?? [];
  const allRoutes = rules.find((rule) => rule.source === "/:path*");
  return new Map((allRoutes?.headers ?? []).map(({ key, value }) => [key, value]));
}

function directives(csp: string | undefined): Map<string, string[]> {
  return new Map(
    (csp ?? "")
      .split(";")
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("security headers", () => {
  it("sends the baseline headers on every route", async () => {
    const headers = await headersFor("production");

    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
  });

  it("enforces a CSP that blocks framing, plugins, and eval in production", async () => {
    const csp = directives((await headersFor("production")).get("Content-Security-Policy"));

    expect(csp.get("default-src")).toEqual(["'self'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.get("script-src")).not.toContain("'unsafe-eval'");
    expect(csp.get("connect-src")).toEqual(["'self'", "https://example-project.supabase.co"]);
  });

  it("allows eval only in development, where React needs it", async () => {
    const csp = directives((await headersFor("development")).get("Content-Security-Policy"));

    expect(csp.get("script-src")).toContain("'unsafe-eval'");
  });
});
