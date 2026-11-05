import "server-only";

import {
  byDoctor,
  computeKpis,
  heatmap,
  monthlyVolume,
  ratesBySlot,
  statusByMonth,
  type AnalyticsAppointment,
  type AnalyticsDatasets,
} from "@/lib/analytics/metrics";
import {
  analyticsPeriodBounds,
  analyticsPeriodMonths,
  type AnalyticsQuery,
} from "@/lib/analytics/period";

/**
 * Read-only, system-wide appointment reads for the analytics metric layer
 * (ADM-10). Callers must have passed `getAdminSession()`.
 */
export type AnalyticsReader = {
  /** Every appointment whose `scheduled_at` is in `[start, end)`, narrowed by doctor and department. */
  listAppointments(query: {
    start: string;
    end: string;
    doctorId: string | null;
    departmentId: string | null;
  }): Promise<AnalyticsAppointment[]>;
  /** Current `requested` count: a snapshot, not limited to the period. */
  countPending(query: { doctorId: string | null; departmentId: string | null }): Promise<number>;
};

/** Every analytics dataset for one period, computed from a single read. */
export async function loadAnalytics(
  query: AnalyticsQuery,
  reader: AnalyticsReader,
  now: Date = new Date(),
): Promise<AnalyticsDatasets> {
  const { start, end } = analyticsPeriodBounds(query);
  const months = analyticsPeriodMonths(query);
  const filters = { doctorId: query.doctorId, departmentId: query.departmentId };

  const [rows, pending] = await Promise.all([
    reader.listAppointments({ start, end, ...filters }),
    reader.countPending(filters),
  ]);

  return {
    kpis: { ...computeKpis(rows, now), pending },
    monthly: monthlyVolume(rows, months),
    byDoctor: byDoctor(rows, now),
    heatmap: heatmap(rows),
    statusByMonth: statusByMonth(rows, months),
    ratesBySlot: ratesBySlot(rows, now),
  };
}

export type { AnalyticsDatasets };
