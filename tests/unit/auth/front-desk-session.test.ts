// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { getUser } from "@/server/auth/service";
import { getFrontDeskSession } from "@/server/auth/dal";
import { getProfileForAuthUser } from "@/server/profiles/service";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/service", () => ({ getUser: vi.fn() }));
vi.mock("@/server/profiles/service", () => ({
  getProfileForAuthUser: vi.fn(),
}));

const USER = { id: "auth-user-1", email: "staff@example.test" };

function signedInAs(
  role: "patient" | "doctor" | "admin" | "front_desk",
  fullName = `Synthetic ${role}`,
  isActive = true,
) {
  vi.mocked(getUser).mockResolvedValue(USER);
  vi.mocked(getProfileForAuthUser).mockResolvedValue({
    id: `${role}-profile-1`,
    role,
    fullName,
    isActive,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getFrontDeskSession", () => {
  it("returns the staff profile for a front desk account", async () => {
    signedInAs("front_desk", "Synthetic Front Desk");

    await expect(getFrontDeskSession("/front-desk")).resolves.toEqual({
      user: USER,
      staff: { id: "front_desk-profile-1", fullName: "Synthetic Front Desk" },
    });
  });

  it("falls back to a neutral name when the profile name is blank", async () => {
    signedInAs("front_desk", "   ");

    await expect(getFrontDeskSession("/front-desk")).resolves.toEqual({
      user: USER,
      staff: { id: "front_desk-profile-1", fullName: "Front desk" },
    });
  });

  it.each(["patient", "doctor", "admin"] as const)("denies a %s account", async (role) => {
    signedInAs(role);

    await expect(getFrontDeskSession("/front-desk")).resolves.toBeNull();
  });

  it("denies a deactivated front desk account", async () => {
    signedInAs("front_desk", "Synthetic Front Desk", false);

    await expect(getFrontDeskSession("/front-desk")).resolves.toBeNull();
  });

  it("denies a signed-in account without a profile", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue(null);

    await expect(getFrontDeskSession("/front-desk")).resolves.toBeNull();
  });

  it("redirects an anonymous visitor to sign in with a return path", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(getFrontDeskSession("/front-desk")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Ffront-desk");
    expect(getProfileForAuthUser).not.toHaveBeenCalled();
  });
});
