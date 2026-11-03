// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { toAdminUserRow, toManagedUser } from "@/server/users/repository";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/admin-client", () => ({ getSupabaseAdminClient: vi.fn() }));

const LIST_ROW = {
  id: "00000000-0000-4000-8000-000000000002",
  full_name: "Synthetic Desk",
  email: "desk@example.test",
  role: "front_desk" as const,
  is_active: true,
  created_at: "2026-10-01T00:00:00Z",
  last_sign_in_at: null,
  total_count: 1,
};

// Fields a careless query could return; none may reach the admin UI.
const SENSITIVE_FIELDS = {
  encrypted_password: "$2a$10$synthetic",
  confirmation_token: "token",
  recovery_token: "token",
  raw_app_meta_data: { provider: "email" },
};

describe("toAdminUserRow", () => {
  it("returns exactly the table fields, even when the source row has more", () => {
    const row = toAdminUserRow({ ...LIST_ROW, ...SENSITIVE_FIELDS });

    expect(row).toEqual({
      id: LIST_ROW.id,
      fullName: "Synthetic Desk",
      email: "desk@example.test",
      role: "front_desk",
      isActive: true,
      createdAt: "2026-10-01T00:00:00Z",
      lastSignInAt: null,
    });
    expect(Object.keys(row).sort()).toEqual(
      ["createdAt", "email", "fullName", "id", "isActive", "lastSignInAt", "role"],
    );
  });
});

describe("toManagedUser", () => {
  it("returns exactly the detail fields", () => {
    const user = toManagedUser({
      ...LIST_ROW,
      ...SENSITIVE_FIELDS,
      auth_user_id: "00000000-0000-4000-8000-0000000000a2",
      phone: "09170000000",
      has_doctor_record: false,
    });

    expect(Object.keys(user).sort()).toEqual([
      "authUserId",
      "createdAt",
      "email",
      "fullName",
      "hasDoctorRecord",
      "id",
      "isActive",
      "lastSignInAt",
      "phone",
      "role",
    ]);
    expect(user.phone).toBe("09170000000");
  });
});
