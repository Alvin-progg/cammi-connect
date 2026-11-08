// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/dal";
import { saveSpecialtyAction, setSpecialtyActiveAction } from "@/server/specialties/actions";
import { saveSpecialty, setSpecialtyActive } from "@/server/specialties/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/specialties/repository", () => ({ supabaseSpecialtyAdminRepository: {} }));
vi.mock("@/server/specialties/service", () => ({
  saveSpecialty: vi.fn(),
  setSpecialtyActive: vi.fn(),
}));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000701";

const ADMIN_SESSION = {
  user: { id: "auth-admin", email: "admin@example.test" },
  admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
};

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
  vi.mocked(saveSpecialty).mockResolvedValue({
    ok: true,
    specialtyId: SPECIALTY_ID,
    message: "Specialty saved.",
  });
  vi.mocked(setSpecialtyActive).mockResolvedValue({ ok: true, message: "Specialty deactivated." });
});

describe("specialty actions", () => {
  it("denies non-admin accounts without calling the service", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const denied = { status: "error", message: "You are not authorized to manage specialties." };

    await expect(saveSpecialtyAction(IDLE, formData({ name: "Neurology" }))).resolves.toEqual(denied);
    await expect(
      setSpecialtyActiveAction(IDLE, formData({ specialtyId: SPECIALTY_ID, isActive: "false" })),
    ).resolves.toEqual(denied);
    expect(saveSpecialty).not.toHaveBeenCalled();
    expect(setSpecialtyActive).not.toHaveBeenCalled();
  });

  it("creates a specialty as the session admin and opens it", async () => {
    await saveSpecialtyAction(IDLE, formData({ name: " Neurology ", description: "", actorId: "forged" }));

    expect(saveSpecialty).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, specialtyId: null, input: { name: "Neurology", description: null } },
      expect.anything(),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(updateTag).toHaveBeenCalledWith("reference");
    expect(redirect).toHaveBeenCalledWith(`/admin/specialties/${SPECIALTY_ID}`);
  });

  it("updates an existing specialty in place", async () => {
    await expect(
      saveSpecialtyAction(IDLE, formData({ specialtyId: SPECIALTY_ID, name: "Cardiology" })),
    ).resolves.toEqual({ status: "success", message: "Specialty saved." });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns validation errors without saving", async () => {
    await expect(saveSpecialtyAction(IDLE, formData({ name: "" }))).resolves.toEqual({
      status: "error",
      message: "Enter a specialty name.",
    });
    expect(saveSpecialty).not.toHaveBeenCalled();
  });

  it("changes the status as the session admin", async () => {
    await expect(
      setSpecialtyActiveAction(IDLE, formData({ specialtyId: SPECIALTY_ID, isActive: "false" })),
    ).resolves.toEqual({ status: "success", message: "Specialty deactivated." });
    expect(setSpecialtyActive).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, specialtyId: SPECIALTY_ID, isActive: false },
      expect.anything(),
    );
  });

  it("rejects a malformed specialty id", async () => {
    await expect(
      setSpecialtyActiveAction(IDLE, formData({ specialtyId: "nope", isActive: "true" })),
    ).resolves.toEqual({ status: "error", message: "That specialty is not valid." });
  });
});
