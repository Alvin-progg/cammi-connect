// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/dal";
import { saveServiceAction, setServiceActiveAction } from "@/server/services/actions";
import { saveService, setServiceActive } from "@/server/services/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/services/repository", () => ({ supabaseServiceAdminRepository: {} }));
vi.mock("@/server/services/service", () => ({
  saveService: vi.fn(),
  setServiceActive: vi.fn(),
}));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const RADIOLOGY_ID = "00000000-0000-4000-8000-000000000301";
const SERVICE_ID = "00000000-0000-4000-8000-000000000801";

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
  vi.mocked(saveService).mockResolvedValue({
    ok: true,
    serviceId: SERVICE_ID,
    message: "Service saved.",
  });
  vi.mocked(setServiceActive).mockResolvedValue({ ok: true, message: "Service deactivated." });
});

describe("service actions", () => {
  it("denies non-admin accounts without calling the service layer", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const denied = { status: "error", message: "You are not authorized to manage services." };

    await expect(saveServiceAction(IDLE, formData({ name: "X-ray" }))).resolves.toEqual(denied);
    await expect(
      setServiceActiveAction(IDLE, formData({ serviceId: SERVICE_ID, isActive: "false" })),
    ).resolves.toEqual(denied);
    expect(saveService).not.toHaveBeenCalled();
    expect(setServiceActive).not.toHaveBeenCalled();
  });

  it("creates a service as the session admin and opens it", async () => {
    await saveServiceAction(
      IDLE,
      formData({
        name: " X-ray ",
        description: "",
        departmentId: RADIOLOGY_ID,
        requiresAppointment: "on",
        bookingMode: "walk_in",
        actorId: "forged",
      }),
    );

    expect(saveService).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        serviceId: null,
        input: {
          name: "X-ray",
          description: null,
          departmentId: RADIOLOGY_ID,
          requiresAppointment: true,
          bookingMode: "walk_in",
        },
      },
      expect.anything(),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(updateTag).toHaveBeenCalledWith("reference");
    expect(redirect).toHaveBeenCalledWith(`/admin/services/${SERVICE_ID}`);
  });

  it("treats a missing checkbox as no appointment required and updates in place", async () => {
    await expect(
      saveServiceAction(IDLE, formData({ serviceId: SERVICE_ID, name: "Lab", bookingMode: "none" })),
    ).resolves.toEqual({ status: "success", message: "Service saved." });
    expect(vi.mocked(saveService).mock.calls[0][0]).toMatchObject({
      serviceId: SERVICE_ID,
      input: { requiresAppointment: false, departmentId: null },
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns validation errors without saving", async () => {
    await expect(saveServiceAction(IDLE, formData({ name: "" }))).resolves.toEqual({
      status: "error",
      message: "Enter a service name.",
    });
    await expect(
      saveServiceAction(IDLE, formData({ name: "X-ray", bookingMode: "equipment_slot" })),
    ).resolves.toEqual({ status: "error", message: "Choose how patients access the service." });
    expect(saveService).not.toHaveBeenCalled();
  });

  it("rejects a malformed service id", async () => {
    const invalid = { status: "error", message: "That service is not valid." };
    await expect(
      saveServiceAction(IDLE, formData({ serviceId: "nope", name: "X-ray" })),
    ).resolves.toEqual(invalid);
    await expect(
      setServiceActiveAction(IDLE, formData({ serviceId: "nope", isActive: "true" })),
    ).resolves.toEqual(invalid);
  });

  it("passes a refusal through as an error", async () => {
    vi.mocked(saveService).mockResolvedValue({
      ok: false,
      message: "A service with that name already exists.",
    });

    await expect(saveServiceAction(IDLE, formData({ name: "x-ray" }))).resolves.toEqual({
      status: "error",
      message: "A service with that name already exists.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("changes the status as the session admin", async () => {
    await expect(
      setServiceActiveAction(IDLE, formData({ serviceId: SERVICE_ID, isActive: "false" })),
    ).resolves.toEqual({ status: "success", message: "Service deactivated." });
    expect(setServiceActive).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, serviceId: SERVICE_ID, isActive: false },
      expect.anything(),
    );
  });
});
