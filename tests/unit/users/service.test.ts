// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminUserDetail } from "@/lib/users/types";
import type { AuditLogWriter } from "@/server/audit/service";
import {
  changeUserRole,
  inviteStaff,
  listUsers,
  sendUserPasswordReset,
  setUserActive,
  updateUserProfile,
  type UserAdminStore,
} from "@/server/users/service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const TARGET_ID = "00000000-0000-4000-8000-000000000002";
const AUTH_USER_ID = "00000000-0000-4000-8000-0000000000a2";

const TARGET: AdminUserDetail & { authUserId: string } = {
  id: TARGET_ID,
  authUserId: AUTH_USER_ID,
  fullName: "Synthetic Desk",
  email: "desk@example.test",
  phone: null,
  role: "front_desk",
  isActive: true,
  createdAt: "2026-10-01T00:00:00Z",
  lastSignInAt: null,
  hasDoctorRecord: false,
};

function fakeStore(): { [K in keyof UserAdminStore]: ReturnType<typeof vi.fn> } {
  return {
    listUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
    getUser: vi.fn().mockResolvedValue(TARGET),
    listActivity: vi.fn().mockResolvedValue([]),
    inviteUser: vi.fn().mockResolvedValue({ ok: true, authUserId: AUTH_USER_ID }),
    provisionStaff: vi.fn().mockResolvedValue({ ok: true, profileId: TARGET_ID }),
    setRole: vi.fn().mockResolvedValue({ ok: true }),
    setActive: vi.fn().mockResolvedValue({ ok: true }),
    updateProfile: vi.fn().mockResolvedValue({ ok: true }),
    setSignInBlocked: vi.fn().mockResolvedValue(true),
    sendPasswordReset: vi.fn().mockResolvedValue(true),
  };
}

let store: ReturnType<typeof fakeStore>;
const asStore = () => store as unknown as UserAdminStore;

beforeEach(() => {
  store = fakeStore();
});

describe("listUsers", () => {
  it("turns filters into a page query and reports the page count", async () => {
    store.listUsers.mockResolvedValue({ users: [], total: 51 });

    await expect(
      listUsers({ search: "maya", role: "doctor", status: "inactive", page: 3 }, asStore()),
    ).resolves.toEqual({ users: [], total: 51, page: 3, pageCount: 3 });
    expect(store.listUsers).toHaveBeenCalledWith({
      search: "maya",
      role: "doctor",
      isActive: false,
      limit: 25,
      offset: 50,
    });
  });

  it("sends no search, role, or status filter when they are empty", async () => {
    await listUsers({ search: "", role: null, status: null, page: 1 }, asStore());
    expect(store.listUsers).toHaveBeenCalledWith({
      search: null,
      role: null,
      isActive: null,
      limit: 25,
      offset: 0,
    });
  });
});

describe("inviteStaff", () => {
  const INPUT = { email: "desk@example.test", fullName: "Synthetic Desk", role: "front_desk" as const, phone: null };

  it("invites the user and then provisions the staff profile as the acting admin", async () => {
    await expect(inviteStaff({ actorId: ADMIN_ID, input: INPUT }, asStore())).resolves.toEqual({
      ok: true,
      profileId: TARGET_ID,
    });
    expect(store.inviteUser).toHaveBeenCalledWith({ email: INPUT.email, fullName: INPUT.fullName });
    expect(store.provisionStaff).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      authUserId: AUTH_USER_ID,
      role: "front_desk",
      fullName: "Synthetic Desk",
      phone: null,
    });
  });

  it("reports an email that already has an account without provisioning", async () => {
    store.inviteUser.mockResolvedValue({ ok: false, code: "email_exists" });

    await expect(inviteStaff({ actorId: ADMIN_ID, input: INPUT }, asStore())).resolves.toEqual({
      ok: false,
      message: "An account with this email already exists.",
    });
    expect(store.provisionStaff).not.toHaveBeenCalled();
  });

  it("explains that the invite went out when provisioning fails", async () => {
    store.provisionStaff.mockResolvedValue({ ok: false, code: "not_admin" });

    const result = await inviteStaff({ actorId: ADMIN_ID, input: INPUT }, asStore());
    expect(result).toEqual({ ok: false, message: expect.stringContaining("invitation was sent") });
  });
});

describe("changeUserRole", () => {
  it("changes another account's role with the reason", async () => {
    await expect(
      changeUserRole({ actorId: ADMIN_ID, profileId: TARGET_ID, role: "admin", reason: "Promoted" }, asStore()),
    ).resolves.toEqual({ ok: true, message: "Role updated." });
    expect(store.setRole).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      profileId: TARGET_ID,
      role: "admin",
      reason: "Promoted",
    });
  });

  it("refuses an admin changing their own role before calling the database", async () => {
    store.getUser.mockResolvedValue({ ...TARGET, id: ADMIN_ID, role: "admin" });

    await expect(
      changeUserRole({ actorId: ADMIN_ID, profileId: ADMIN_ID, role: "patient", reason: "x" }, asStore()),
    ).resolves.toEqual({ ok: false, message: expect.stringContaining("your own role") });
    expect(store.setRole).not.toHaveBeenCalled();
  });

  it("refuses accounts with a doctor record", async () => {
    store.getUser.mockResolvedValue({ ...TARGET, role: "doctor", hasDoctorRecord: true });

    await expect(
      changeUserRole({ actorId: ADMIN_ID, profileId: TARGET_ID, role: "patient", reason: "x" }, asStore()),
    ).resolves.toEqual({ ok: false, message: expect.stringContaining("Doctors section") });
    expect(store.setRole).not.toHaveBeenCalled();
  });

  it("reports a missing account", async () => {
    store.getUser.mockResolvedValue(null);

    await expect(
      changeUserRole({ actorId: ADMIN_ID, profileId: TARGET_ID, role: "admin", reason: "x" }, asStore()),
    ).resolves.toEqual({ ok: false, message: "That account no longer exists." });
  });

  it("maps a database refusal to its message", async () => {
    store.setRole.mockResolvedValue({ ok: false, code: "not_admin" });

    await expect(
      changeUserRole({ actorId: ADMIN_ID, profileId: TARGET_ID, role: "admin", reason: "x" }, asStore()),
    ).resolves.toEqual({ ok: false, message: "Only an active administrator can manage accounts." });
  });

  it("uses a generic message for an unexpected database error", async () => {
    store.setRole.mockResolvedValue({ ok: false, code: undefined });

    await expect(
      changeUserRole({ actorId: ADMIN_ID, profileId: TARGET_ID, role: "admin", reason: "x" }, asStore()),
    ).resolves.toEqual({ ok: false, message: "Something went wrong. Try again." });
  });
});

describe("setUserActive", () => {
  it("blocks sign-in and then deactivates the profile", async () => {
    await expect(
      setUserActive({ actorId: ADMIN_ID, profileId: TARGET_ID, isActive: false, reason: "On leave" }, asStore()),
    ).resolves.toEqual({ ok: true, message: "Account deactivated." });
    expect(store.setSignInBlocked).toHaveBeenCalledWith(AUTH_USER_ID, true);
    expect(store.setActive).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      profileId: TARGET_ID,
      isActive: false,
      reason: "On leave",
    });
  });

  it("unblocks sign-in when reactivating", async () => {
    store.getUser.mockResolvedValue({ ...TARGET, isActive: false });

    await expect(
      setUserActive({ actorId: ADMIN_ID, profileId: TARGET_ID, isActive: true, reason: "Back" }, asStore()),
    ).resolves.toEqual({ ok: true, message: "Account activated." });
    expect(store.setSignInBlocked).toHaveBeenCalledWith(AUTH_USER_ID, false);
  });

  it("changes nothing when sign-in access cannot be updated", async () => {
    store.setSignInBlocked.mockResolvedValue(false);

    await expect(
      setUserActive({ actorId: ADMIN_ID, profileId: TARGET_ID, isActive: false, reason: "x" }, asStore()),
    ).resolves.toEqual({ ok: false, message: expect.stringContaining("Nothing was changed") });
    expect(store.setActive).not.toHaveBeenCalled();
  });

  it("restores sign-in access when the database refuses", async () => {
    store.setActive.mockResolvedValue({ ok: false, code: "not_admin" });

    await setUserActive({ actorId: ADMIN_ID, profileId: TARGET_ID, isActive: false, reason: "x" }, asStore());
    expect(store.setSignInBlocked).toHaveBeenNthCalledWith(1, AUTH_USER_ID, true);
    expect(store.setSignInBlocked).toHaveBeenNthCalledWith(2, AUTH_USER_ID, false);
  });

  it("refuses self-deactivation without touching sign-in", async () => {
    store.getUser.mockResolvedValue({ ...TARGET, id: ADMIN_ID, role: "admin" });

    await expect(
      setUserActive({ actorId: ADMIN_ID, profileId: ADMIN_ID, isActive: false, reason: "x" }, asStore()),
    ).resolves.toEqual({ ok: false, message: expect.stringContaining("your own role or status") });
    expect(store.setSignInBlocked).not.toHaveBeenCalled();
  });
});

describe("updateUserProfile", () => {
  it("saves name and phone as the acting admin", async () => {
    await expect(
      updateUserProfile(
        { actorId: ADMIN_ID, profileId: TARGET_ID, fullName: "Synthetic B", phone: "09170000000" },
        asStore(),
      ),
    ).resolves.toEqual({ ok: true, message: "Profile saved." });
    expect(store.updateProfile).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      profileId: TARGET_ID,
      fullName: "Synthetic B",
      phone: "09170000000",
    });
  });
});

describe("sendUserPasswordReset", () => {
  function fakeAudit(): AuditLogWriter & { insert: ReturnType<typeof vi.fn> } {
    return { insert: vi.fn().mockResolvedValue(undefined) };
  }

  it("sends the reset email and records who requested it", async () => {
    const audit = fakeAudit();

    await expect(
      sendUserPasswordReset({ actorId: ADMIN_ID, profileId: TARGET_ID }, asStore(), audit),
    ).resolves.toEqual({ ok: true, message: "Password reset email sent." });
    expect(store.sendPasswordReset).toHaveBeenCalledWith("desk@example.test");
    expect(audit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorProfileId: ADMIN_ID,
        action: "user.password_reset_requested",
        targetType: "user",
        targetId: TARGET_ID,
      }),
    );
  });

  it("records nothing when the email cannot be sent", async () => {
    const audit = fakeAudit();
    store.sendPasswordReset.mockResolvedValue(false);

    await expect(
      sendUserPasswordReset({ actorId: ADMIN_ID, profileId: TARGET_ID }, asStore(), audit),
    ).resolves.toEqual({ ok: false, message: expect.stringContaining("could not be sent") });
    expect(audit.insert).not.toHaveBeenCalled();
  });
});
