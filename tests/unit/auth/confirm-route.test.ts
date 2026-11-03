// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "@/app/auth/confirm/route";
import { verifyEmailLink } from "@/server/auth/service";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/service", () => ({ verifyEmailLink: vi.fn() }));

function request(query: string) {
  return new NextRequest(`https://cammi.example.test/auth/confirm${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyEmailLink).mockResolvedValue(true);
});

describe("GET /auth/confirm", () => {
  it.each(["invite", "recovery"] as const)(
    "verifies a %s link and sends the user to set a password",
    async (type) => {
      const response = await GET(request(`?token_hash=hash-123&type=${type}`));

      expect(verifyEmailLink).toHaveBeenCalledWith({ tokenHash: "hash-123", type });
      expect(response.headers.get("location")).toBe(
        "https://cammi.example.test/account/password",
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  it("refuses other link types without verifying them", async () => {
    const response = await GET(request("?token_hash=hash-123&type=email_change"));

    expect(verifyEmailLink).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://cammi.example.test/login?error=callback",
    );
  });

  it("refuses a link without a token", async () => {
    const response = await GET(request("?type=invite"));

    expect(verifyEmailLink).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://cammi.example.test/login?error=callback",
    );
  });

  it("sends an expired or used link back to sign in", async () => {
    vi.mocked(verifyEmailLink).mockResolvedValue(false);

    const response = await GET(request("?token_hash=hash-123&type=recovery"));

    expect(response.headers.get("location")).toBe(
      "https://cammi.example.test/login?error=callback",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
