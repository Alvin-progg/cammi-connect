// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { getUser } from "@/server/auth/service";
import { redirectIfSignedIn } from "@/server/auth/dal";
import { getProfileForAuthUser } from "@/server/profiles/service";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/service", () => ({ getUser: vi.fn() }));
vi.mock("@/server/profiles/service", () => ({
  getProfileForAuthUser: vi.fn(),
}));

const USER = { id: "auth-user-1", email: "person@example.test" };

function signedInAs(
  role: "patient" | "doctor" | "admin" | "front_desk",
  { isActive = true }: { isActive?: boolean } = {},
) {
  vi.mocked(getUser).mockResolvedValue(USER);
  vi.mocked(getProfileForAuthUser).mockResolvedValue({
    id: `${role}-profile-1`,
    role,
    fullName: `Synthetic ${role}`,
    isActive,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("redirectIfSignedIn", () => {
  it("lets an anonymous visitor see the page", async () => {
    vi.mocked(getUser).mockResolvedValue(null);

    await redirectIfSignedIn();

    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["admin", "/admin"],
    ["front_desk", "/front-desk"],
    ["doctor", "/doctor"],
    ["patient", "/chat"],
  ] as const)("sends a signed-in %s to %s", async (role, path) => {
    signedInAs(role);

    await redirectIfSignedIn();

    expect(redirect).toHaveBeenCalledWith(path);
  });

  it("does not redirect a deactivated account", async () => {
    signedInAs("admin", { isActive: false });

    await redirectIfSignedIn();

    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not redirect an account without a profile", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue(null);

    await redirectIfSignedIn();

    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not redirect when the profile lookup fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockRejectedValue(new Error("db down"));

    await redirectIfSignedIn();

    expect(redirect).not.toHaveBeenCalled();
  });
});
