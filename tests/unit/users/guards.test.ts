import { describe, expect, it } from "vitest";

import {
  checkActiveChange,
  checkRoleChange,
  refusalFromCode,
  USER_ADMIN_REFUSAL_MESSAGES,
} from "@/lib/users/guards";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";

function account(overrides: Partial<{ id: string; role: "patient" | "doctor" | "admin" | "front_desk"; isActive: boolean; hasDoctorRecord: boolean }> = {}) {
  return { id: OTHER_ID, role: "front_desk" as const, isActive: true, hasDoctorRecord: false, ...overrides };
}

describe("checkRoleChange", () => {
  it("allows an admin to change another account's role", () => {
    expect(checkRoleChange({ actorId: ADMIN_ID, target: account(), newRole: "admin" })).toBeNull();
    expect(
      checkRoleChange({ actorId: ADMIN_ID, target: account({ role: "patient" }), newRole: "front_desk" }),
    ).toBeNull();
  });

  it("refuses a change to the role the account already has", () => {
    expect(checkRoleChange({ actorId: ADMIN_ID, target: account(), newRole: "front_desk" })).toBe(
      "unchanged",
    );
  });

  it("refuses an admin changing their own role, so they cannot lock themselves out", () => {
    expect(
      checkRoleChange({ actorId: ADMIN_ID, target: account({ id: ADMIN_ID, role: "admin" }), newRole: "patient" }),
    ).toBe("self_change");
  });

  it("protects the last active admin: only the acting admin could be it, and self-changes are refused", () => {
    // With one active admin, the actor is that admin; demoting anyone else leaves them in place.
    expect(
      checkRoleChange({ actorId: ADMIN_ID, target: account({ id: ADMIN_ID, role: "admin" }), newRole: "front_desk" }),
    ).toBe("self_change");
  });

  it("refuses accounts with a doctor directory record", () => {
    expect(
      checkRoleChange({
        actorId: ADMIN_ID,
        target: account({ role: "doctor", hasDoctorRecord: true }),
        newRole: "patient",
      }),
    ).toBe("doctor_record");
  });
});

describe("checkActiveChange", () => {
  it("allows deactivating and reactivating another account", () => {
    expect(checkActiveChange({ actorId: ADMIN_ID, target: account(), isActive: false })).toBeNull();
    expect(
      checkActiveChange({ actorId: ADMIN_ID, target: account({ isActive: false }), isActive: true }),
    ).toBeNull();
  });

  it("refuses an admin deactivating themselves", () => {
    expect(
      checkActiveChange({ actorId: ADMIN_ID, target: account({ id: ADMIN_ID, role: "admin" }), isActive: false }),
    ).toBe("self_change");
  });

  it("refuses a change to the current status", () => {
    expect(checkActiveChange({ actorId: ADMIN_ID, target: account(), isActive: true })).toBe("unchanged");
  });
});

describe("refusalFromCode", () => {
  it("recognises the database refusal codes and nothing else", () => {
    expect(refusalFromCode("doctor_record")).toBe("doctor_record");
    expect(refusalFromCode("not_admin")).toBe("not_admin");
    expect(refusalFromCode("duplicate key value")).toBeNull();
    expect(refusalFromCode(undefined)).toBeNull();
  });

  it("has a message for every refusal", () => {
    for (const message of Object.values(USER_ADMIN_REFUSAL_MESSAGES)) {
      expect(message.length).toBeGreaterThan(0);
    }
  });
});
