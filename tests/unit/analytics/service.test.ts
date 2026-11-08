// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { AnalyticsAppointment } from "@/lib/analytics/metrics";
import { loadAnalytics, type AnalyticsReader } from "@/server/analytics/service";

vi.mock("server-only", () => ({}));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000010";
const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000020";
const NOW = new Date("2026-11-05T04:00:00.000Z");

const COMPLETED: AnalyticsAppointment = {
  id: "00000000-0000-4000-8000-000000000100",
  doctorId: DOCTOR_ID,
  doctorName: "Dr. Synthetic",
  scheduledAt: "2026-10-05T01:00:00.000Z",
  scheduledEndAt: "2026-10-05T01:30:00.000Z",
  status: "completed",
  confirmedAt: "2026-10-01T01:00:00.000Z",
  confirmedInAudit: true,
  cancelledAt: null,
};

function fakeReader(rows: AnalyticsAppointment[], pending: number) {
  return {
    listAppointments: vi.fn<AnalyticsReader["listAppointments"]>().mockResolvedValue(rows),
    countPending: vi.fn<AnalyticsReader["countPending"]>().mockResolvedValue(pending),
  } satisfies AnalyticsReader;
}

describe("loadAnalytics", () => {
  it("reads the period's appointments with Manila bounds and the doctor and department filters", async () => {
    const reader = fakeReader([], 0);

    await loadAnalytics(
      { from: "2026-10-01", to: "2026-11-01", doctorId: DOCTOR_ID, departmentId: DEPARTMENT_ID },
      reader,
      NOW,
    );

    expect(reader.listAppointments).toHaveBeenCalledWith({
      start: "2026-09-30T16:00:00.000Z",
      end: "2026-10-31T16:00:00.000Z",
      doctorId: DOCTOR_ID,
      departmentId: DEPARTMENT_ID,
    });
    expect(reader.countPending).toHaveBeenCalledWith({ doctorId: DOCTOR_ID, departmentId: DEPARTMENT_ID });
  });

  it("returns every dataset computed from the same rows, with the pending snapshot in the KPIs", async () => {
    const reader = fakeReader([COMPLETED], 4);

    const analytics = await loadAnalytics(
      { from: "2026-10-01", to: "2026-11-01", doctorId: null, departmentId: null },
      reader,
      NOW,
    );

    expect(analytics.kpis).toEqual({
      total: 1,
      outcomeCount: 1,
      completed: 1,
      cancelled: 0,
      noShow: 0,
      completionRate: 100,
      cancellationRate: 0,
      noShowRate: 0,
      outcomeMonths: { first: "2026-10", last: "2026-10" },
      busiestMonth: { month: "2026-10", total: 1 },
      peakSlot: { weekday: "Mon", slot: "9–11 AM", count: 1 },
      pending: 4,
    });
    expect(analytics.monthly).toEqual([{ month: "2026-10", total: 1 }]);
    expect(analytics.byDoctor).toEqual([
      {
        doctorId: DOCTOR_ID,
        doctorName: "Dr. Synthetic",
        shortName: "Synthetic",
        total: 1,
        outcomeCount: 1,
        cancellationRate: 0,
        noShowRate: 0,
      },
    ]);
    expect(analytics.heatmap.cells.find((cell) => cell.count > 0)).toEqual({
      weekday: "Mon",
      slot: "9–11 AM",
      count: 1,
    });
    expect(analytics.heatmap.outsideHours).toBe(0);
    expect(analytics.outcomesByMonth).toEqual([{ month: "2026-10", completed: 1, cancelled: 0, noShow: 0 }]);
    expect(analytics.ratesByWeekday).toEqual([
      { weekday: "Mon", outcomeCount: 1, cancellationRate: 0, noShowRate: 0 },
    ]);
  });

  it("refuses an invalid period without reading", async () => {
    const reader = fakeReader([], 0);

    await expect(
      loadAnalytics({ from: "2026-11-01", to: "2026-10-01", doctorId: null, departmentId: null }, reader, NOW),
    ).rejects.toThrow(RangeError);
    expect(reader.listAppointments).not.toHaveBeenCalled();
  });
});
