// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/dal";
import {
  saveDepartmentAction,
  setDepartmentActiveAction,
} from "@/server/departments/actions";
import { saveDepartment, setDepartmentActive } from "@/server/departments/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/departments/repository", () => ({ supabaseDepartmentAdminRepository: {} }));
vi.mock("@/server/departments/service", () => ({
  saveDepartment: vi.fn(),
  setDepartmentActive: vi.fn(),
}));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000501";

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
  vi.mocked(saveDepartment).mockResolvedValue({
    ok: true,
    departmentId: DEPARTMENT_ID,
    message: "Department saved.",
  });
  vi.mocked(setDepartmentActive).mockResolvedValue({ ok: true, message: "Department deactivated." });
});

describe("department actions", () => {
  it("denies non-admin accounts without calling the service", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const denied = { status: "error", message: "You are not authorized to manage departments." };

    await expect(
      saveDepartmentAction(IDLE, formData({ name: "Neurology", code: "NEU" })),
    ).resolves.toEqual(denied);
    await expect(
      setDepartmentActiveAction(IDLE, formData({ departmentId: DEPARTMENT_ID, isActive: "false" })),
    ).resolves.toEqual(denied);
    expect(saveDepartment).not.toHaveBeenCalled();
    expect(setDepartmentActive).not.toHaveBeenCalled();
  });

  it("creates a department as the session admin and opens it", async () => {
    await saveDepartmentAction(
      IDLE,
      formData({ name: " Neurology ", code: "neu", description: "", actorId: "forged" }),
    );

    expect(saveDepartment).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        departmentId: null,
        input: { name: "Neurology", code: "NEU", description: null },
      },
      expect.anything(),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
    expect(redirect).toHaveBeenCalledWith(`/admin/departments/${DEPARTMENT_ID}`);
  });

  it("updates an existing department in place", async () => {
    await expect(
      saveDepartmentAction(
        IDLE,
        formData({ departmentId: DEPARTMENT_ID, name: "Cardiology", code: "CARD" }),
      ),
    ).resolves.toEqual({ status: "success", message: "Department saved." });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns validation errors without saving", async () => {
    await expect(saveDepartmentAction(IDLE, formData({ name: "", code: "X" }))).resolves.toEqual({
      status: "error",
      message: "Enter a department name.",
    });
    expect(saveDepartment).not.toHaveBeenCalled();
  });

  it("passes the conflicting appointments back when deactivation is refused", async () => {
    const conflicts = [
      {
        appointmentId: "00000000-0000-4000-8000-000000000201",
        scheduledAt: "2026-11-10T01:00:00Z",
        status: "confirmed" as const,
        doctorName: "Dr. Maya Santos",
      },
    ];
    vi.mocked(setDepartmentActive).mockResolvedValue({ ok: false, message: "Blocked", conflicts });

    await expect(
      setDepartmentActiveAction(IDLE, formData({ departmentId: DEPARTMENT_ID, isActive: "false" })),
    ).resolves.toEqual({ status: "error", message: "Blocked", conflicts });
    expect(setDepartmentActive).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, departmentId: DEPARTMENT_ID, isActive: false },
      expect.anything(),
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a malformed department id", async () => {
    await expect(
      setDepartmentActiveAction(IDLE, formData({ departmentId: "nope", isActive: "false" })),
    ).resolves.toEqual({ status: "error", message: "That department is not valid." });
  });
});
