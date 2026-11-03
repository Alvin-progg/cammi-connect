// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { config, proxy } from "@/proxy";

const getClaims = vi.fn();

vi.mock("@/lib/config.public", () => ({
  getPublicEnv: () => ({
    supabaseUrl: "https://synthetic.supabase.test",
    supabasePublishableKey: "synthetic-publishable-key",
  }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("proxy for /front-desk", () => {
  it("runs on front desk routes", () => {
    expect(config.matcher).toContain("/front-desk/:path*");
  });

  it("redirects an anonymous visitor to sign in with a return path", async () => {
    getClaims.mockResolvedValue({ data: null });

    const response = await proxy(new NextRequest("http://localhost/front-desk"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/front-desk");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("lets a signed-in visitor through without caching the response", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "auth-user-1" } } });

    const response = await proxy(new NextRequest("http://localhost/front-desk"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
