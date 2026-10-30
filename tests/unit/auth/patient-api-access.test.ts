// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

import { getUser } from "@/server/auth/service";
import { resolvePatientForApi } from "@/server/auth/dal";
import { getProfileForAuthUser } from "@/server/profiles/service";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/service", () => ({ getUser: vi.fn() }));
vi.mock("@/server/profiles/service", () => ({
  getProfileForAuthUser: vi.fn(),
}));

const USER = { id: "auth-user-1", email: "patient@example.test" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePatientForApi", () => {
  it("reports an anonymous request without redirecting", async () => {
    vi.mocked(getUser).mockResolvedValue(null);

    await expect(resolvePatientForApi()).resolves.toEqual({
      status: "unauthenticated",
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(getProfileForAuthUser).not.toHaveBeenCalled();
  });

  it("forbids a doctor account", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue({
      id: "doctor-profile-1",
      role: "doctor",
      fullName: "Dr. Maya Santos",
    });

    await expect(resolvePatientForApi()).resolves.toEqual({ status: "forbidden" });
  });

  it("forbids a signed-in account without a profile", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue(null);

    await expect(resolvePatientForApi()).resolves.toEqual({ status: "forbidden" });
  });

  it("returns the patient profile for a patient account", async () => {
    vi.mocked(getUser).mockResolvedValue(USER);
    vi.mocked(getProfileForAuthUser).mockResolvedValue({
      id: "patient-profile-1",
      role: "patient",
      fullName: "Synthetic Patient A",
    });

    await expect(resolvePatientForApi()).resolves.toEqual({
      status: "ok",
      patient: { id: "patient-profile-1", fullName: "Synthetic Patient A" },
    });
  });
});
