// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { recordAdminAudit, type AuditLogWriter } from "@/server/audit/service";

vi.mock("server-only", () => ({}));

const ADMIN_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000501";

function fakeWriter(): AuditLogWriter & { insert: ReturnType<typeof vi.fn> } {
  return { insert: vi.fn().mockResolvedValue(undefined) };
}

describe("recordAdminAudit", () => {
  it("writes the actor, action, target, and reason", async () => {
    const writer = fakeWriter();

    await recordAdminAudit(
      {
        actorProfileId: ADMIN_PROFILE_ID,
        action: "department.update",
        targetType: "department",
        targetId: DEPARTMENT_ID,
        previousValues: { name: "Cardio" },
        newValues: { name: "Cardiology" },
        reason: "Typo fix",
      },
      writer,
    );

    expect(writer.insert).toHaveBeenCalledWith({
      actorProfileId: ADMIN_PROFILE_ID,
      action: "department.update",
      targetType: "department",
      targetId: DEPARTMENT_ID,
      previousValues: { name: "Cardio" },
      newValues: { name: "Cardiology" },
      reason: "Typo fix",
    });
  });

  it("redacts sensitive keys from both payloads before writing", async () => {
    const writer = fakeWriter();

    await recordAdminAudit(
      {
        actorProfileId: ADMIN_PROFILE_ID,
        action: "settings.update",
        targetType: "setting",
        targetId: "ai_provider",
        previousValues: { model: "a", apiKey: "old" },
        newValues: { model: "b", nested: { secret: "new" } },
      },
      writer,
    );

    expect(writer.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        previousValues: { model: "a" },
        newValues: { model: "b", nested: {} },
      }),
    );
  });

  it("stores absent payloads and reason as null", async () => {
    const writer = fakeWriter();

    await recordAdminAudit(
      {
        actorProfileId: ADMIN_PROFILE_ID,
        action: "department.create",
        targetType: "department",
        targetId: DEPARTMENT_ID,
      },
      writer,
    );

    expect(writer.insert).toHaveBeenCalledWith(
      expect.objectContaining({ previousValues: null, newValues: null, reason: null }),
    );
  });
});
