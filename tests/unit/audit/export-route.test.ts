// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/audit-log/export/route";
import type { AuditLogEntry } from "@/lib/audit/log";
import { supabaseAuditLogReader, supabaseAuditLogRepository } from "@/server/audit/repository";
import { getAdminSession } from "@/server/auth/dal";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/audit/repository", () => ({
  supabaseAuditLogRepository: { insert: vi.fn() },
  supabaseAuditLogReader: { list: vi.fn(), get: vi.fn() },
}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

const ENTRY: AuditLogEntry = {
  id: "00000000-0000-4000-8000-000000000901",
  createdAt: "2026-11-08T01:05:00.000Z",
  actorProfileId: ADMIN_ID,
  actorName: "Synthetic Admin",
  action: "settings.update",
  targetType: "system_settings",
  targetId: "system_settings",
  reason: null,
  previousValues: { "chatbot.enabled": true },
  newValues: { "chatbot.enabled": false },
};

function exportRequest(query = "") {
  return new NextRequest(`http://localhost/api/admin/audit-log/export${query ? `?${query}` : ""}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminSession).mockResolvedValue({
    user: { id: "auth-user", email: "admin@example.test" },
    admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
  });
  vi.mocked(supabaseAuditLogReader.list).mockResolvedValue({ items: [ENTRY], total: 1 });
});

describe("GET /api/admin/audit-log/export", () => {
  it("refuses non-admins without reading or auditing", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);

    const response = await GET(exportRequest());

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(supabaseAuditLogReader.list).not.toHaveBeenCalled();
    expect(supabaseAuditLogRepository.insert).not.toHaveBeenCalled();
  });

  it("returns the filtered entries as CSV and audits the export", async () => {
    const response = await GET(exportRequest("action=settings&from=2026-11-01&bogus=1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="audit-log.csv"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const csv = await response.text();
    expect(csv).toContain("settings.update");
    expect(vi.mocked(supabaseAuditLogReader.list).mock.calls[0][0].filters).toMatchObject({
      actionPrefix: "settings",
      from: "2026-11-01",
    });
    expect(supabaseAuditLogRepository.insert).toHaveBeenCalledWith({
      actorProfileId: ADMIN_ID,
      action: "audit.export",
      targetType: "audit_logs",
      targetId: "export",
      previousValues: null,
      newValues: {
        actorId: null,
        actionPrefix: "settings",
        targetType: null,
        from: "2026-11-01",
        to: null,
        rows: 1,
      },
      reason: null,
    });
  });

  it("refuses an export over the row cap and asks to narrow the filters", async () => {
    vi.mocked(supabaseAuditLogReader.list).mockResolvedValue({ items: [ENTRY], total: 10_001 });

    const response = await GET(exportRequest());

    expect(response.status).toBe(413);
    await expect(response.text()).resolves.toContain("Narrow the filters");
    expect(supabaseAuditLogRepository.insert).not.toHaveBeenCalled();
  });
});
