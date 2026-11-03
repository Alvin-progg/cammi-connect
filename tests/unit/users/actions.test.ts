// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/server/auth/dal";
import {
  changeUserRoleAction,
  inviteStaffAction,
  sendPasswordResetAction,
  setUserActiveAction,
  updateUserProfileAction,
} from "@/server/users/actions";
import {
  changeUserRole,
  inviteStaff,
  sendUserPasswordReset,
  setUserActive,
  updateUserProfile,
} from "@/server/users/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/users/repository", () => ({ supabaseUserAdminRepository: {} }));
vi.mock("@/server/audit/repository", () => ({ supabaseAuditLogRepository: {} }));
vi.mock("@/server/users/service", () => ({
  changeUserRole: vi.fn(),
  inviteStaff: vi.fn(),
  sendUserPasswordReset: vi.fn(),
  setUserActive: vi.fn(),
  updateUserProfile: vi.fn(),
}));

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const TARGET_ID = "00000000-0000-4000-8000-000000000002";
const FORGED_ACTOR_ID = "00000000-0000-4000-8000-000000000099";

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
  vi.mocked(changeUserRole).mockResolvedValue({ ok: true, message: "Role updated." });
  vi.mocked(setUserActive).mockResolvedValue({ ok: true, message: "Account deactivated." });
  vi.mocked(updateUserProfile).mockResolvedValue({ ok: true, message: "Profile saved." });
  vi.mocked(sendUserPasswordReset).mockResolvedValue({ ok: true, message: "Password reset email sent." });
  vi.mocked(inviteStaff).mockResolvedValue({ ok: true, profileId: TARGET_ID });
});

describe("user admin actions", () => {
  it("denies non-admin accounts without calling any service", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const denied = { status: "error", message: "You are not authorized to manage accounts." };

    await expect(
      changeUserRoleAction(IDLE, formData({ profileId: TARGET_ID, role: "admin", reason: "x" })),
    ).resolves.toEqual(denied);
    await expect(
      setUserActiveAction(IDLE, formData({ profileId: TARGET_ID, isActive: "false", reason: "x" })),
    ).resolves.toEqual(denied);
    await expect(
      updateUserProfileAction(IDLE, formData({ profileId: TARGET_ID, fullName: "Synthetic B" })),
    ).resolves.toEqual(denied);
    await expect(sendPasswordResetAction(IDLE, formData({ profileId: TARGET_ID }))).resolves.toEqual(denied);
    await expect(
      inviteStaffAction(IDLE, formData({ email: "a@example.test", fullName: "Synthetic A", role: "admin" })),
    ).resolves.toEqual(denied);

    expect(changeUserRole).not.toHaveBeenCalled();
    expect(setUserActive).not.toHaveBeenCalled();
    expect(updateUserProfile).not.toHaveBeenCalled();
    expect(sendUserPasswordReset).not.toHaveBeenCalled();
    expect(inviteStaff).not.toHaveBeenCalled();
  });

  it("changes a role as the session admin, ignoring any actor in the form", async () => {
    await expect(
      changeUserRoleAction(
        IDLE,
        formData({ profileId: TARGET_ID, role: "admin", reason: " Promoted ", actorId: FORGED_ACTOR_ID }),
      ),
    ).resolves.toEqual({ status: "success", message: "Role updated." });
    expect(changeUserRole).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, profileId: TARGET_ID, role: "admin", reason: "Promoted" },
      expect.anything(),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users", "layout");
  });

  it("returns validation errors without calling the service", async () => {
    await expect(
      changeUserRoleAction(IDLE, formData({ profileId: TARGET_ID, role: "admin", reason: "" })),
    ).resolves.toEqual({ status: "error", message: "Enter a reason for this change." });
    expect(changeUserRole).not.toHaveBeenCalled();
  });

  it("passes a service refusal through as an error", async () => {
    vi.mocked(changeUserRole).mockResolvedValue({ ok: false, message: "Nothing to change." });

    await expect(
      changeUserRoleAction(IDLE, formData({ profileId: TARGET_ID, role: "admin", reason: "x" })),
    ).resolves.toEqual({ status: "error", message: "Nothing to change." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reads the requested status from the form", async () => {
    await setUserActiveAction(IDLE, formData({ profileId: TARGET_ID, isActive: "false", reason: "On leave" }));
    expect(setUserActive).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, profileId: TARGET_ID, isActive: false, reason: "On leave" },
      expect.anything(),
    );
  });

  it("updates the profile with a normalised phone", async () => {
    await updateUserProfileAction(
      IDLE,
      formData({ profileId: TARGET_ID, fullName: "Synthetic B", phone: "0917 000 0000" }),
    );
    expect(updateUserProfile).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, profileId: TARGET_ID, fullName: "Synthetic B", phone: "09170000000" },
      expect.anything(),
    );
  });

  it("sends a password reset for the account", async () => {
    await expect(sendPasswordResetAction(IDLE, formData({ profileId: TARGET_ID }))).resolves.toEqual({
      status: "success",
      message: "Password reset email sent.",
    });
    expect(sendUserPasswordReset).toHaveBeenCalledWith(
      { actorId: ADMIN_ID, profileId: TARGET_ID },
      expect.anything(),
      expect.anything(),
    );
  });

  it("invites staff and opens the new account", async () => {
    await inviteStaffAction(
      IDLE,
      formData({ email: "desk@example.test", fullName: "Synthetic Desk", role: "front_desk", phone: "" }),
    );
    expect(inviteStaff).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        input: { email: "desk@example.test", fullName: "Synthetic Desk", role: "front_desk", phone: null },
      },
      expect.anything(),
    );
    expect(redirect).toHaveBeenCalledWith(`/admin/users/${TARGET_ID}`);
  });

  it("refuses to invite a patient", async () => {
    await expect(
      inviteStaffAction(IDLE, formData({ email: "p@example.test", fullName: "Synthetic P", role: "patient" })),
    ).resolves.toEqual({ status: "error", message: "Choose a staff role." });
    expect(inviteStaff).not.toHaveBeenCalled();
  });
});
