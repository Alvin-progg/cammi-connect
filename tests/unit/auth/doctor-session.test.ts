// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { getUser } from "@/server/auth/service";
import { getDoctorSession } from "@/server/auth/dal";
import { getProfileForAuthUser } from "@/server/profiles/service";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/service", () => ({ getUser: vi.fn() }));
vi.mock("@/server/profiles/service", () => ({
  getProfileForAuthUser: vi.fn(),
}));

const USER = { id: "auth-user-1", email: "doctor@example.test" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDoctorSession", () => {
  it("returns the doctor profile for a doctor account", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue({
      id: "doctor-profile-1",
      role: "doctor",
      fullName: "Dr. Maya Santos",
    });

    await expect(getDoctorSession("/doctor")).resolves.toEqual({
      user: USER,
      doctor: { id: "doctor-profile-1", fullName: "Dr. Maya Santos" },
    });
  });

  it("denies a patient account", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue({
      id: "patient-profile-1",
      role: "patient",
      fullName: "Synthetic Patient A",
    });

    await expect(getDoctorSession("/doctor")).resolves.toBeNull();
  });

  it("denies a signed-in account without a profile", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue(null);

    await expect(getDoctorSession("/doctor")).resolves.toBeNull();
  });

  it("redirects an anonymous visitor to sign in with a return path", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(getDoctorSession("/doctor")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fdoctor");
    expect(getProfileForAuthUser).not.toHaveBeenCalled();
  });
});
