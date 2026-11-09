// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cookieSet = vi.fn(() => {
  throw new Error(
    "Cookies can only be modified in a Server Action or Route Handler.",
  );
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: cookieSet }),
}));

vi.mock("@/lib/config.public", () => ({
  getPublicEnv: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "publishable-key",
  }),
}));

type CookieAdapter = {
  setAll: (
    cookies: { name: string; value: string; options: object }[],
  ) => void;
};

const createServerClient =
  vi.fn<
    (url: string, key: string, options: { cookies: CookieAdapter }) => object
  >(() => ({}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

describe("createSupabaseServerClient", () => {
  it("ignores cookie writes rejected during Server Component rendering", async () => {
    const { createSupabaseServerClient } = await import(
      "@/server/auth/client"
    );
    await createSupabaseServerClient();

    const adapter = createServerClient.mock.calls[0][2].cookies;

    expect(() =>
      adapter.setAll([{ name: "sb-token", value: "refreshed", options: {} }]),
    ).not.toThrow();
    expect(cookieSet).toHaveBeenCalledWith("sb-token", "refreshed", {});
  });
});
