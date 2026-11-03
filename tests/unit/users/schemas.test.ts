import { describe, expect, it } from "vitest";

import {
  activeChangeSchema,
  parseUserListFilters,
  profileUpdateSchema,
  roleChangeSchema,
  staffInviteSchema,
} from "@/lib/users/schemas";

const PROFILE_ID = "00000000-0000-4000-8000-000000000002";

describe("staffInviteSchema", () => {
  it("accepts a staff invite and normalises email and phone", () => {
    expect(
      staffInviteSchema.parse({
        email: "  Desk.Two@Example.TEST ",
        fullName: " Synthetic Desk ",
        role: "front_desk",
        phone: "0917 000-0000",
      }),
    ).toEqual({
      email: "desk.two@example.test",
      fullName: "Synthetic Desk",
      role: "front_desk",
      phone: "09170000000",
    });
  });

  it("treats a blank phone as none", () => {
    expect(
      staffInviteSchema.parse({ email: "a@example.test", fullName: "Synthetic A", role: "admin", phone: "" })
        .phone,
    ).toBeNull();
  });

  it("only accepts staff roles", () => {
    expect(
      staffInviteSchema.safeParse({ email: "a@example.test", fullName: "Synthetic A", role: "patient" }).success,
    ).toBe(false);
  });

  it("rejects an invalid email and a missing name", () => {
    expect(staffInviteSchema.safeParse({ email: "nope", fullName: "Synthetic A", role: "admin" }).success).toBe(
      false,
    );
    expect(staffInviteSchema.safeParse({ email: "a@example.test", fullName: " ", role: "admin" }).success).toBe(
      false,
    );
  });
});

describe("roleChangeSchema", () => {
  it("requires a reason for every role change", () => {
    expect(roleChangeSchema.safeParse({ profileId: PROFILE_ID, role: "admin", reason: "  " }).success).toBe(false);
    expect(
      roleChangeSchema.parse({ profileId: PROFILE_ID, role: "patient", reason: " Left the hospital " }),
    ).toEqual({ profileId: PROFILE_ID, role: "patient", reason: "Left the hospital" });
  });

  it("rejects an unknown role or a malformed id", () => {
    expect(roleChangeSchema.safeParse({ profileId: PROFILE_ID, role: "owner", reason: "x" }).success).toBe(false);
    expect(roleChangeSchema.safeParse({ profileId: "abc", role: "admin", reason: "x" }).success).toBe(false);
  });
});

describe("activeChangeSchema", () => {
  it("requires a reason", () => {
    expect(activeChangeSchema.safeParse({ profileId: PROFILE_ID, isActive: false, reason: "" }).success).toBe(false);
    expect(activeChangeSchema.parse({ profileId: PROFILE_ID, isActive: false, reason: "On leave" })).toEqual({
      profileId: PROFILE_ID,
      isActive: false,
      reason: "On leave",
    });
  });
});

describe("profileUpdateSchema", () => {
  it("trims the name and normalises the phone", () => {
    expect(
      profileUpdateSchema.parse({ profileId: PROFILE_ID, fullName: " Synthetic B ", phone: "(02) 555-0100" }),
    ).toEqual({ profileId: PROFILE_ID, fullName: "Synthetic B", phone: "025550100" });
  });
});

describe("parseUserListFilters", () => {
  it("falls back to defaults for missing or invalid values", () => {
    expect(parseUserListFilters({})).toEqual({ search: "", role: null, status: null, page: 1 });
    expect(parseUserListFilters({ role: "owner", status: "gone", page: "-3" })).toEqual({
      search: "",
      role: null,
      status: null,
      page: 1,
    });
  });

  it("reads search, role, status, and page, taking the first repeated value", () => {
    expect(
      parseUserListFilters({ q: " maya ", role: ["doctor", "admin"], status: "inactive", page: "3" }),
    ).toEqual({ search: "maya", role: "doctor", status: "inactive", page: 3 });
  });
});
