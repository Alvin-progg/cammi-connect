// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { AnalyticsAppointment } from "@/lib/analytics/metrics";
import { loadDashboard, type DashboardReader, type PendingSummary } from "@/server/analytics/service";

vi.mock("server-only", () => ({}));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000010";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000020";
const NOW = new Date("2026-11-05T04:00:00.000Z");
/** Monday-to-Sunday week, 2026-11-02 to 2026-11-08 (exclusive end 11-09). */
const WEEK = { from: "2026-11-02", to: "2026-11-09", doctorId: DOCTOR_ID, departmentId: DEPARTMENT_ID };

function appointment(status: AnalyticsAppointment["status"], index: number): AnalyticsAppointment {
  return {
    id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
    doctorId: DOCTOR_ID,
    doctorName: "Dr. Synthetic",
    // Monday 2026-11-02, 09:00 Manila.
    scheduledAt: "2026-11-02T01:00:00.000Z",
    scheduledEndAt: "2026-11-02T01:30:00.000Z",
    status,
    confirmedAt: "2026-11-01T01:00:00.000Z",
    confirmedInAudit: true,
    cancelledAt: null,
  };
}

const PENDING: PendingSummary = {
  count: 3,
  oldestCreatedAt: "2026-11-01T02:00:00.000Z",
  byDepartment: [{ departmentName: "Synthetic Medicine", count: 3 }],
};

function fakeReader(current: AnalyticsAppointment[], previous: AnalyticsAppointment[]) {
  return {
    listAppointments: vi
      .fn<DashboardReader["listAppointments"]>()
      .mockImplementation(async ({ start }) => (start === "2026-11-01T16:00:00.000Z" ? current : previous)),
    countPending: vi.fn<DashboardReader["countPending"]>().mockResolvedValue(PENDING.count),
    countCancelledBetween: vi.fn<DashboardReader["countCancelledBetween"]>().mockResolvedValue(6),
    pendingSummary: vi.fn<DashboardReader["pendingSummary"]>().mockResolvedValue(PENDING),
    listRecentAppointmentActivity: vi.fn<DashboardReader["listRecentAppointmentActivity"]>().mockResolvedValue([]),
    listRecentAdminActivity: vi.fn<DashboardReader["listRecentAdminActivity"]>().mockResolvedValue([]),
  } satisfies DashboardReader;
}

describe("loadDashboard", () => {
  it("reads this period and the previous equal-length period with the same filters", async () => {
    const reader = fakeReader([], []);

    await loadDashboard(WEEK, reader, NOW);

    const filters = { doctorId: DOCTOR_ID, departmentId: DEPARTMENT_ID };
    // Manila midnight is 16:00 UTC the day before.
    expect(reader.listAppointments).toHaveBeenCalledWith({
      start: "2026-11-01T16:00:00.000Z",
      end: "2026-11-08T16:00:00.000Z",
      ...filters,
    });
    expect(reader.listAppointments).toHaveBeenCalledWith({
      start: "2026-10-25T16:00:00.000Z",
      end: "2026-11-01T16:00:00.000Z",
      ...filters,
    });
    expect(reader.countCancelledBetween).toHaveBeenCalledWith({
      start: "2026-11-01T16:00:00.000Z",
      end: "2026-11-08T16:00:00.000Z",
      ...filters,
    });
    expect(reader.pendingSummary).toHaveBeenCalledWith(filters);
    expect(reader.listRecentAppointmentActivity).toHaveBeenCalledWith(10);
    expect(reader.listRecentAdminActivity).toHaveBeenCalledWith(10);
  });

  it("builds cards, trend, and charts; Cancelled comes from the cancellation-date count", async () => {
    const current = [
      appointment("completed", 1),
      appointment("completed", 2),
      appointment("no_show", 3),
      appointment("cancelled", 4),
      appointment("rejected", 5),
    ];
    const reader = fakeReader(current, [appointment("completed", 6), appointment("confirmed", 7)]);

    const dashboard = await loadDashboard(WEEK, reader, NOW);

    expect(dashboard.cards).toEqual({ total: 4, confirmed: 0, completed: 2, noShow: 1, cancelled: 6 });
    expect(dashboard.pending).toEqual(PENDING);
    expect(dashboard.trend).toEqual({ previousTotal: 2, percent: 100 });
    expect(dashboard.daily).toHaveLength(7);
    expect(dashboard.daily[0]).toEqual({ date: "2026-11-02", total: 4 });
    expect(dashboard.statusDistribution).toMatchObject({ completed: 2, no_show: 1, cancelled: 1 });
    expect(dashboard.topDoctors).toEqual([
      expect.objectContaining({ doctorId: DOCTOR_ID, total: 4, noShowRate: 25 }),
    ]);
  });

  it("refuses an invalid period without reading", async () => {
    const reader = fakeReader([], []);

    await expect(loadDashboard({ ...WEEK, to: "2026-11-01" }, reader, NOW)).rejects.toThrow(RangeError);
    expect(reader.listAppointments).not.toHaveBeenCalled();
  });
});
