import { describe, expect, it } from "vitest";

import {
  AUDIT_LOG_PATH,
  auditLogCsv,
  auditLogDateBounds,
  auditLogExportHref,
  auditLogListHref,
  auditTargetHref,
  diffAuditValues,
  parseAuditLogFilters,
} from "@/lib/audit/log";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DOCTOR_ID = "00000000-0000-4000-8000-0000000000d1";

describe("parseAuditLogFilters", () => {
  it("defaults to everything, page 1", () => {
    expect(parseAuditLogFilters({})).toEqual({
      actorId: null,
      actionPrefix: null,
      targetType: null,
      from: null,
      to: null,
      page: 1,
    });
  });

  it("keeps known values and drops unknown ones", () => {
    expect(
      parseAuditLogFilters({
        actor: ADMIN_ID,
        action: "settings",
        target: "doctor",
        from: "2026-11-01",
        to: "2026-11-08",
        page: "3",
      }),
    ).toEqual({
      actorId: ADMIN_ID,
      actionPrefix: "settings",
      targetType: "doctor",
      from: "2026-11-01",
      to: "2026-11-08",
      page: 3,
    });

    expect(
      parseAuditLogFilters({
        actor: "not-a-uuid",
        action: "settings.%",
        target: "appointments",
        from: "2026-02-30",
        page: "-1",
      }),
    ).toEqual({
      actorId: null,
      actionPrefix: null,
      targetType: null,
      from: null,
      to: null,
      page: 1,
    });
  });

  it("swaps a reversed date range", () => {
    const filters = parseAuditLogFilters({ from: "2026-11-08", to: "2026-11-01" });
    expect([filters.from, filters.to]).toEqual(["2026-11-01", "2026-11-08"]);
  });
});

describe("auditLogDateBounds", () => {
  it("covers whole Manila days", () => {
    expect(auditLogDateBounds({ from: "2026-11-01", to: "2026-11-01" })).toEqual({
      start: "2026-10-31T16:00:00.000Z",
      end: "2026-11-01T16:00:00.000Z",
    });
    expect(auditLogDateBounds({ from: null, to: null })).toEqual({ start: null, end: null });
  });
});

describe("auditLogListHref and auditLogExportHref", () => {
  const filters = parseAuditLogFilters({ action: "doctor", from: "2026-11-01", page: "2" });

  it("keeps the filters and the page", () => {
    expect(auditLogListHref(filters)).toBe(`${AUDIT_LOG_PATH}?action=doctor&from=2026-11-01&page=2`);
    expect(auditLogListHref(filters, 1)).toBe(`${AUDIT_LOG_PATH}?action=doctor&from=2026-11-01`);
    expect(auditLogListHref(parseAuditLogFilters({}))).toBe(AUDIT_LOG_PATH);
  });

  it("exports the filters without the page", () => {
    expect(auditLogExportHref(filters)).toBe(
      "/api/admin/audit-log/export?action=doctor&from=2026-11-01",
    );
  });
});

describe("auditTargetHref", () => {
  it("links records that have an admin page", () => {
    expect(auditTargetHref("doctor", DOCTOR_ID)).toBe(`/admin/doctors/${DOCTOR_ID}`);
    expect(auditTargetHref("user", ADMIN_ID)).toBe(`/admin/users/${ADMIN_ID}`);
    expect(auditTargetHref("knowledge_document", DOCTOR_ID)).toBe(
      `/admin/knowledge-base/${DOCTOR_ID}`,
    );
    expect(auditTargetHref("system_settings", "system_settings")).toBe("/admin/settings");
  });

  it("does not link targets without a page or with a non-UUID id", () => {
    expect(auditTargetHref("schedule", DOCTOR_ID)).toBeNull();
    expect(auditTargetHref("analytics", "kpis")).toBeNull();
    expect(auditTargetHref("doctor", "../users")).toBeNull();
  });
});

describe("diffAuditValues", () => {
  it("lists every key, marking which changed", () => {
    expect(
      diffAuditValues(
        { name: "Radiology", code: "RAD", is_active: true },
        { name: "Imaging", code: "RAD", description: "X-ray" },
      ),
    ).toEqual([
      { key: "code", previous: "RAD", next: "RAD", changed: false },
      { key: "description", previous: undefined, next: "X-ray", changed: true },
      { key: "is_active", previous: true, next: undefined, changed: true },
      { key: "name", previous: "Radiology", next: "Imaging", changed: true },
    ]);
  });

  it("treats a missing side as empty", () => {
    expect(diffAuditValues(null, { role: "doctor" })).toEqual([
      { key: "role", previous: undefined, next: "doctor", changed: true },
    ]);
    expect(diffAuditValues(null, null)).toEqual([]);
  });

  it("compares nested values as JSON", () => {
    expect(
      diffAuditValues({ ids: ["a", "b"] }, { ids: ["a", "b"] }).map((row) => row.changed),
    ).toEqual([false]);
  });
});

describe("auditLogCsv", () => {
  it("writes Manila times, the actor, target, reason, and both value sets as JSON", () => {
    const csv = auditLogCsv([
      {
        id: "00000000-0000-4000-8000-000000000901",
        createdAt: "2026-11-08T01:05:00.000Z",
        actorProfileId: ADMIN_ID,
        actorName: "Synthetic Admin",
        action: "department.update",
        targetType: "department",
        targetId: DOCTOR_ID,
        reason: "=HYPERLINK(\"x\")",
        previousValues: { name: "Cardio" },
        newValues: { name: "Cardiology" },
      },
    ]);

    const [header, row] = csv.split("\r\n");
    expect(header).toBe(
      "Time (Asia/Manila),Actor,Actor ID,Action,Target type,Target ID,Reason,Previous values,New values",
    );
    expect(row).toBe(
      `2026-11-08 09:05,Synthetic Admin,${ADMIN_ID},department.update,department,${DOCTOR_ID},` +
        `"'=HYPERLINK(""x"")","{""name"":""Cardio""}","{""name"":""Cardiology""}"`,
    );
  });
});
