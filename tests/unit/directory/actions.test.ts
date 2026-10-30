// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import {
  saveDepartmentAction,
  saveDoctorAction,
  saveSpecialtyAction,
} from "@/server/directory/actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/directory/repository", () => ({
  supabaseDirectoryRepository: {
    listDepartments: vi.fn(),
    saveDepartment: vi.fn(),
    listSpecialties: vi.fn(),
    saveSpecialty: vi.fn(),
    listDoctors: vi.fn(),
    getDoctor: vi.fn(),
    saveDoctor: vi.fn(),
    listLinkableAccounts: vi.fn(),
  },
}));

const IDLE = { status: "idle" } as const;
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000701";
const store = vi.mocked(supabaseDirectoryRepository);

const ADMIN_SESSION = {
  user: { id: "auth-admin", email: "admin@example.test" },
  admin: { id: "admin-profile-1", fullName: "Synthetic Admin" },
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

beforeEach(() => {
  vi.clearAllMocks();
  store.saveDepartment.mockResolvedValue("saved");
  store.saveSpecialty.mockResolvedValue("saved");
  store.saveDoctor.mockResolvedValue("saved");
  store.listDepartments.mockResolvedValue([]);
  store.listSpecialties.mockResolvedValue([
    { id: SPECIALTY_ID, name: "Internal Medicine", description: null, isActive: true },
  ]);
});

describe("directory actions", () => {
  it("lets an admin create a department", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);

    await expect(
      saveDepartmentAction(
        IDLE,
        formData({ name: "Neurology", code: "neu", description: "", isActive: "on" }),
      ),
    ).resolves.toEqual({ status: "success", message: "Department saved." });
    expect(store.saveDepartment).toHaveBeenCalledWith({
      id: null,
      name: "Neurology",
      code: "NEU",
      description: null,
      isActive: true,
    });
  });

  it("lets an admin save a doctor with several specialty checkboxes", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);

    await expect(
      saveDoctorAction(
        IDLE,
        formData({
          fullName: "Dr. Ana Cruz",
          departmentId: "",
          profileId: "",
          specialtyIds: [SPECIALTY_ID, SPECIALTY_ID],
          isActive: "on",
        }),
      ),
    ).resolves.toEqual({ status: "success", message: "Doctor saved." });
    expect(store.saveDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: null, specialtyIds: [SPECIALTY_ID] }),
    );
  });

  it("denies non-admin accounts every directory write", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const denied = {
      status: "error",
      message: "You are not authorized to manage the hospital directory.",
    };

    await expect(
      saveDepartmentAction(IDLE, formData({ name: "X", code: "X", isActive: "on" })),
    ).resolves.toEqual(denied);
    await expect(
      saveSpecialtyAction(IDLE, formData({ name: "X", isActive: "on" })),
    ).resolves.toEqual(denied);
    await expect(
      saveDoctorAction(
        IDLE,
        formData({ fullName: "Dr. X", specialtyIds: SPECIALTY_ID, isActive: "on" }),
      ),
    ).resolves.toEqual(denied);
    expect(store.saveDepartment).not.toHaveBeenCalled();
    expect(store.saveSpecialty).not.toHaveBeenCalled();
    expect(store.saveDoctor).not.toHaveBeenCalled();
  });
});
