// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { getUser } from "@/server/auth/service";
import { getAdminSession, getDoctorSession } from "@/server/auth/dal";
import { getProfileForAuthUser } from "@/server/profiles/service";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/service", () => ({ getUser: vi.fn() }));
vi.mock("@/server/profiles/service", () => ({ getProfileForAuthUser: vi.fn() }));

// Stand-in for React's per-request `cache`: the whole test is one request.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
      const results = new Map<string, R>();
      return (...args: A): R => {
        const key = JSON.stringify(args);
        if (!results.has(key)) results.set(key, fn(...args));
        return results.get(key) as R;
      };
    },
  };
});

describe("session guards within one request", () => {
  it("look up the auth user and profile once, however many guards run", async () => {
    vi.mocked(getUser).mockResolvedValue({ id: "auth-user-1", email: "doctor@example.test" });
    vi.mocked(getProfileForAuthUser).mockResolvedValue({
      id: "doctor-profile-1",
      role: "doctor",
      fullName: "Dr. Maya Santos",
      isActive: true,
    });

    // Layout and page both guard the same request.
    await getDoctorSession("/doctor");
    await getDoctorSession("/doctor");
    await expect(getAdminSession("/admin")).resolves.toBeNull();

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getProfileForAuthUser).toHaveBeenCalledTimes(1);
  });
});
