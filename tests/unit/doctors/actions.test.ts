// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/dal";
import {
  linkDoctorAccountAction,
  saveDoctorAction,
  setDoctorActiveAction,
} from "@/server/doctors/actions";
import { linkDoctorAccount, saveDoctor, setDoctorActive } from "@/server/doctors/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/doctors/repository", () => ({ supabaseDoctorAdminRepository: {} }));
vi.mock("@/server/doctors/service", () => ({
  saveDoctor: vi.fn(),
  linkDoctorAccount: vi.fn(),
  setDoctorActive: vi.fn(),
}));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000011";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000501";
const SPECIALTY_A = "00000000-0000-4000-8000-000000000701";
const SPECIALTY_B = "00000000-0000-4000-8000-000000000702";

const ADMIN_SESSION = {
  user: { id: "auth-admin", email: "admin@example.test" },
  admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
};

function formData(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
}

const DOCTOR_FIELDS = {
  fullName: "Dr. Ana Cruz",
  departmentId: DEPARTMENT_ID,
  specialtyIds: [SPECIALTY_A, SPECIALTY_B],
  contactEmail: "ana.cruz@example.test",
  contactPhone: "",
  bio: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
  vi.mocked(saveDoctor).mockResolvedValue({ ok: true, doctorId: DOCTOR_ID, message: "Doctor saved." });
  vi.mocked(linkDoctorAccount).mockResolvedValue({ ok: true, message: "Account linked." });
  vi.mocked(setDoctorActive).mockResolvedValue({ ok: true, message: "Doctor deactivated." });
});

describe("doctor actions", () => {
  it("denies non-admin accounts without calling the service", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const denied = { status: "error", message: "You are not authorized to manage doctors." };

    await expect(saveDoctorAction(IDLE, formData(DOCTOR_FIELDS))).resolves.toEqual(denied);
    await expect(
      linkDoctorAccountAction(IDLE, formData({ doctorId: DOCTOR_ID, accountProfileId: ACCOUNT_ID })),
    ).resolves.toEqual(denied);
    await expect(
      setDoctorActiveAction(IDLE, formData({ doctorId: DOCTOR_ID, isActive: "false" })),
    ).resolves.toEqual(denied);
    expect(saveDoctor).not.toHaveBeenCalled();
    expect(linkDoctorAccount).not.toHaveBeenCalled();
    expect(setDoctorActive).not.toHaveBeenCalled();
  });

  it("creates a doctor with several specialties as the session admin and opens it", async () => {
    await saveDoctorAction(IDLE, formData({ ...DOCTOR_FIELDS, accountProfileId: ACCOUNT_ID }));

    expect(saveDoctor).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        doctorId: null,
        input: {
          fullName: "Dr. Ana Cruz",
          departmentId: DEPARTMENT_ID,
          specialtyIds: [SPECIALTY_A, SPECIALTY_B],
          contactEmail: "ana.cruz@example.test",
          contactPhone: null,
          bio: null,
          accountProfileId: ACCOUNT_ID,
        },
      },
      {},
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(updateTag).toHaveBeenCalledWith("reference");
    expect(redirect).toHaveBeenCalledWith(`/admin/doctors/${DOCTOR_ID}`);
  });

  it("updates an existing doctor in place", async () => {
    await expect(
      saveDoctorAction(IDLE, formData({ ...DOCTOR_FIELDS, doctorId: DOCTOR_ID })),
    ).resolves.toEqual({ status: "success", message: "Doctor saved." });
    expect(saveDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ADMIN_ID, doctorId: DOCTOR_ID }),
      {},
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns validation errors without saving", async () => {
    await expect(
      saveDoctorAction(IDLE, formData({ ...DOCTOR_FIELDS, specialtyIds: [] })),
    ).resolves.toEqual({ status: "error", message: "Choose at least one specialty." });
    expect(saveDoctor).not.toHaveBeenCalled();
  });

  it("rejects malformed doctor ids", async () => {
    const invalid = { status: "error", message: "That doctor is not valid." };
    await expect(
      saveDoctorAction(IDLE, formData({ ...DOCTOR_FIELDS, doctorId: "not-a-uuid" })),
    ).resolves.toEqual(invalid);
    await expect(
      setDoctorActiveAction(IDLE, formData({ doctorId: "not-a-uuid", isActive: "false" })),
    ).resolves.toEqual(invalid);
    await expect(
      linkDoctorAccountAction(IDLE, formData({ doctorId: DOCTOR_ID, accountProfileId: "x" })),
    ).resolves.toEqual(invalid);
    expect(saveDoctor).not.toHaveBeenCalled();
    expect(setDoctorActive).not.toHaveBeenCalled();
    expect(linkDoctorAccount).not.toHaveBeenCalled();
  });

  it("links an account as the session admin", async () => {
    await expect(
      linkDoctorAccountAction(IDLE, formData({ doctorId: DOCTOR_ID, accountProfileId: ACCOUNT_ID })),
    ).resolves.toEqual({ status: "success", message: "Account linked." });
    expect(linkDoctorAccount).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, doctorId: DOCTOR_ID, accountProfileId: ACCOUNT_ID },
      {},
    );
  });

  it("passes the conflicting appointments back when deactivation is refused", async () => {
    const conflicts = [
      {
        appointmentId: "00000000-0000-4000-8000-000000000201",
        scheduledAt: "2026-11-10T01:00:00Z",
        status: "confirmed" as const,
      },
    ];
    vi.mocked(setDoctorActive).mockResolvedValue({ ok: false, message: "Blocked.", conflicts });

    await expect(
      setDoctorActiveAction(IDLE, formData({ doctorId: DOCTOR_ID, isActive: "false" })),
    ).resolves.toEqual({ status: "error", message: "Blocked.", conflicts });
    expect(setDoctorActive).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, doctorId: DOCTOR_ID, isActive: false },
      {},
    );
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });
});
