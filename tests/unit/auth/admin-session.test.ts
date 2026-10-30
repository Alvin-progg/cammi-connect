// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { getUser } from "@/server/auth/service";
import { getAdminSession, getPatientSession } from "@/server/auth/dal";
import { getProfileForAuthUser } from "@/server/profiles/service";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/service", () => ({ getUser: vi.fn() }));
vi.mock("@/server/profiles/service", () => ({
  getProfileForAuthUser: vi.fn(),
}));

const USER = { id: "auth-user-1", email: "person@example.test" };

function signedInAs(role: "patient" | "doctor" | "admin") {
  vi.mocked(getUser).mockResolvedValue(USER);
  vi.mocked(getProfileForAuthUser).mockResolvedValue({
    id: `${role}-profile-1`,
    role,
    fullName: `Synthetic ${role}`,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminSession", () => {
  it("returns the admin profile for an admin account", async () => {
    signedInAs("admin");

    await expect(getAdminSession("/admin")).resolves.toEqual({
      user: USER,
      admin: { id: "admin-profile-1", fullName: "Synthetic admin" },
    });
  });

  it.each(["patient", "doctor"] as const)("denies a %s account", async (role) => {
    signedInAs(role);

    await expect(getAdminSession("/admin")).resolves.toBeNull();
  });

  it("denies a signed-in account without a profile", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue(null);

    await expect(getAdminSession("/admin")).resolves.toBeNull();
  });

  it("redirects an anonymous visitor to sign in with a return path", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(getAdminSession("/admin")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fadmin");
  });
});

describe("getPatientSession", () => {
  it("returns the patient profile for a patient account", async () => {
    signedInAs("patient");

    await expect(getPatientSession("/account")).resolves.toEqual({
      user: USER,
      patient: { id: "patient-profile-1", fullName: "Synthetic patient" },
    });
  });

  it.each(["doctor", "admin"] as const)("denies a %s account", async (role) => {
    signedInAs(role);

    await expect(getPatientSession("/account")).resolves.toBeNull();
  });
});
