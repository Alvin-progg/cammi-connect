// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { parseAuditLogFilters, type AuditLogEntry } from "@/lib/audit/log";
import {
  AUDIT_EXPORT_MAX_ROWS,
  AUDIT_READ_BATCH,
  listAuditLogs,
  loadAuditLogExport,
  type AuditLogReader,
} from "@/server/audit/service";

vi.mock("server-only", () => ({}));

function entry(index: number): AuditLogEntry {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    createdAt: "2026-11-08T01:00:00.000Z",
    actorProfileId: "00000000-0000-4000-8000-000000000001",
    actorName: "Synthetic Admin",
    action: "department.update",
    targetType: "department",
    targetId: "00000000-0000-4000-8000-000000000501",
    reason: null,
    previousValues: null,
    newValues: null,
  };
}

function fakeReader(total: number): AuditLogReader {
  return {
    list: vi.fn(async ({ offset, limit }) => ({
      items: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, index) =>
        entry(offset + index),
      ),
      total,
    })),
    get: vi.fn(async () => null),
  };
}

describe("listAuditLogs", () => {
  it("reads one page of 25 for the requested page, with the filters", async () => {
    const reader = fakeReader(60);
    const filters = parseAuditLogFilters({ action: "doctor", page: "3" });

    const page = await listAuditLogs(filters, reader);

    expect(reader.list).toHaveBeenCalledWith({ filters, offset: 50, limit: 25 });
    expect(page.total).toBe(60);
    expect(page.items).toHaveLength(10);
  });
});

describe("loadAuditLogExport", () => {
  it("reads every matching entry in batches", async () => {
    const reader = fakeReader(AUDIT_READ_BATCH + 5);

    const result = await loadAuditLogExport(parseAuditLogFilters({}), reader);

    expect(result.ok && result.entries).toHaveLength(AUDIT_READ_BATCH + 5);
    expect(reader.list).toHaveBeenCalledTimes(2);
  });

  it("refuses an export over the row cap without reading it all", async () => {
    const reader = fakeReader(AUDIT_EXPORT_MAX_ROWS + 1);

    const result = await loadAuditLogExport(parseAuditLogFilters({}), reader);

    expect(result).toEqual({ ok: false, total: AUDIT_EXPORT_MAX_ROWS + 1 });
    expect(reader.list).toHaveBeenCalledTimes(1);
  });
});
