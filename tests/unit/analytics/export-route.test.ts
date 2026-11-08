// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/admin/analytics/export/route";
import { supabaseAnalyticsRepository } from "@/server/analytics/repository";
import { supabaseAuditLogRepository } from "@/server/audit/repository";
import { getAdminSession } from "@/server/auth/dal";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/analytics/repository", () => ({
  supabaseAnalyticsRepository: { listAppointments: vi.fn(), countPending: vi.fn() },
}));
vi.mock("@/server/audit/repository", () => ({
  supabaseAuditLogRepository: { insert: vi.fn() },
}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000020";

function exportRequest(query: string) {
  return new NextRequest(`http://localhost/api/admin/analytics/export?${query}`);
}

describe("GET /api/admin/analytics/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: new Date("2026-11-05T04:00:00.000Z"), toFake: ["Date"] });
    vi.mocked(getAdminSession).mockResolvedValue({
      user: { id: "auth-user", email: "admin@example.test" },
      admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
    });
    vi.mocked(supabaseAnalyticsRepository.listAppointments).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000100",
        doctorId: "00000000-0000-4000-8000-000000000010",
        doctorName: "Dr. Synthetic",
        scheduledAt: "2026-11-02T01:00:00.000Z",
        scheduledEndAt: "2026-11-02T01:30:00.000Z",
        status: "completed",
        confirmedAt: "2026-11-01T01:00:00.000Z",
        confirmedInAudit: true,
        cancelledAt: null,
      },
    ]);
    vi.mocked(supabaseAnalyticsRepository.countPending).mockResolvedValue(3);
  });

  it("refuses signed-in non-admins without reading or auditing", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);

    const response = await GET(exportRequest("dataset=kpis"));

    expect(response.status).toBe(403);
    expect(getAdminSession).toHaveBeenCalledWith("/admin/analytics");
    expect(supabaseAnalyticsRepository.listAppointments).not.toHaveBeenCalled();
    expect(supabaseAuditLogRepository.insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown dataset", async () => {
    const response = await GET(exportRequest("dataset=patients"));

    expect(response.status).toBe(400);
    expect(supabaseAnalyticsRepository.listAppointments).not.toHaveBeenCalled();
    expect(supabaseAuditLogRepository.insert).not.toHaveBeenCalled();
  });

  it("returns the dataset as a private CSV download and audits the export", async () => {
    const response = await GET(exportRequest(`dataset=monthly&department=${DEPARTMENT_ID}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="analytics-monthly-2026-11-01-to-2026-11-30.csv"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("month,total_appointments\r\n2026-11,1\r\n");

    expect(supabaseAnalyticsRepository.listAppointments).toHaveBeenCalledWith({
      start: "2026-10-31T16:00:00.000Z",
      end: "2026-11-30T16:00:00.000Z",
      doctorId: null,
      departmentId: DEPARTMENT_ID,
    });
    expect(supabaseAuditLogRepository.insert).toHaveBeenCalledWith({
      actorProfileId: ADMIN_ID,
      action: "analytics.export",
      targetType: "analytics",
      targetId: "monthly",
      previousValues: null,
      newValues: {
        range: "this_month",
        from: "2026-11-01",
        to: "2026-11-30",
        doctorId: null,
        departmentId: DEPARTMENT_ID,
      },
      reason: null,
    });
  });

  it("uses the custom range in the file name", async () => {
    const response = await GET(exportRequest("dataset=kpis&range=custom&from=2026-03-01&to=2026-03-31"));

    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="analytics-kpis-2026-03-01-to-2026-03-31.csv"',
    );
  });
});
