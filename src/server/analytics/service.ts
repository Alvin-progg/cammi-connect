import "server-only";

import { interpretAnalytics, summarize, type AnalyticsSummary } from "@/lib/analytics/interpretation";
import {
  byDoctor,
  computeKpis,
  dailyVolume,
  dashboardCards,
  heatmap,
  monthlyVolume,
  ratesByWeekday,
  outcomesByMonth,
  statusDistribution,
  trendPercent,
  type AnalyticsAppointment,
  type AnalyticsDatasets,
  type DailyVolume,
  type DashboardCards,
  type DoctorAnalytics,
  type VolumeStatus,
} from "@/lib/analytics/metrics";
import {
  analyticsPeriodBounds,
  analyticsPeriodDays,
  analyticsPeriodMonths,
  previousPeriod,
  type AnalyticsQuery,
} from "@/lib/analytics/period";
import { revenueSummary, type RevenuePayment, type RevenueSummary } from "@/lib/analytics/revenue";
import type { AppointmentAuditAction } from "@/lib/appointments/audit";
import type { AppointmentStatus } from "@/lib/appointments/status";

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
    outcomesByMonth: outcomesByMonth(rows, months, now),
    ratesByWeekday: ratesByWeekday(rows, now),
  };
}

export type { AnalyticsDatasets };

// ---------------------------------------------------------------------------
// Revenue (PAY-08)
// ---------------------------------------------------------------------------

export type RevenueReader = {
  /**
   * Payments verified, refunded, or HMO-decided in `[start, end)`, plus every
   * open refund_due or unpaid one (the snapshots). No patient fields.
   */
  listRevenuePayments(query: { start: string; end: string }): Promise<RevenuePayment[]>;
};

/** Revenue numbers for the analytics period. Callers must have passed `getAdminSession()`. */
export async function loadRevenue(query: AnalyticsQuery, reader: RevenueReader): Promise<RevenueSummary> {
  const period = analyticsPeriodBounds(query);
  return revenueSummary(await reader.listRevenuePayments(period), period);
}

// ---------------------------------------------------------------------------
// Admin dashboard (ADM-12)
// ---------------------------------------------------------------------------

export const DASHBOARD_ACTIVITY_LIMIT = 10;
const TOP_DOCTOR_COUNT = 5;

/** Current `requested` appointments: a snapshot, read-only on the dashboard ("Front desk queue"). */
export type PendingSummary = {
  count: number;
  /** `created_at` of the oldest pending request, or null when there is none. */
  oldestCreatedAt: string | null;
  /** Busiest department first. */
  byDepartment: { departmentName: string; count: number }[];
};

/** One `appointment_audit_logs` row. No patient details. */
export type AppointmentActivityEntry = {
  id: string;
  appointmentId: string;
  action: AppointmentAuditAction;
  previousStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  actorName: string | null;
  createdAt: string;
};

/** One `audit_logs` row. */
export type AdminActivityEntry = {
  id: string;
  action: string;
  targetType: string;
  actorName: string | null;
  createdAt: string;
};

type PeriodFilters = { start: string; end: string; doctorId: string | null; departmentId: string | null };

export type DashboardReader = AnalyticsReader & {
  /** Appointments now `cancelled` whose latest cancellation audit row is in `[start, end)` (D4). */
  countCancelledBetween(query: PeriodFilters): Promise<number>;
  pendingSummary(query: { doctorId: string | null; departmentId: string | null }): Promise<PendingSummary>;
  /** Newest first, across the hospital. */
  listRecentAppointmentActivity(limit: number): Promise<AppointmentActivityEntry[]>;
  /** Newest first, across the hospital. */
  listRecentAdminActivity(limit: number): Promise<AdminActivityEntry[]>;
};

export type DashboardData = {
  cards: DashboardCards;
  pending: PendingSummary;
  /** Total compared with the previous equal-length period. */
  trend: { previousTotal: number; percent: number | null };
  daily: DailyVolume[];
  statusDistribution: Record<VolumeStatus, number>;
  topDoctors: DoctorAnalytics[];
  /** ADM-17 Summary card, interpreting this period's rows like the analytics page. */
  summary: AnalyticsSummary;
  appointmentActivity: AppointmentActivityEntry[];
  adminActivity: AdminActivityEntry[];
};

/** Everything on the admin dashboard. Callers must have passed `getAdminSession()`. */
export async function loadDashboard(
  query: AnalyticsQuery,
  reader: DashboardReader,
  now: Date = new Date(),
): Promise<DashboardData> {
  const current = analyticsPeriodBounds(query);
  const previous = analyticsPeriodBounds(previousPeriod(query));
  const filters = { doctorId: query.doctorId, departmentId: query.departmentId };

  const [rows, previousRows, cancelled, pending, appointmentActivity, adminActivity] = await Promise.all([
    reader.listAppointments({ ...current, ...filters }),
    reader.listAppointments({ ...previous, ...filters }),
    reader.countCancelledBetween({ ...current, ...filters }),
    reader.pendingSummary(filters),
    reader.listRecentAppointmentActivity(DASHBOARD_ACTIVITY_LIMIT),
    reader.listRecentAdminActivity(DASHBOARD_ACTIVITY_LIMIT),
  ]);

  const cards = dashboardCards(rows, cancelled);
  const previousTotal = dashboardCards(previousRows, 0).total;
  const doctors = byDoctor(rows, now);
  const months = analyticsPeriodMonths(query);
  return {
    cards,
    pending,
    trend: { previousTotal, percent: trendPercent(cards.total, previousTotal) },
    daily: dailyVolume(rows, analyticsPeriodDays(query)),
    statusDistribution: statusDistribution(rows),
    topDoctors: doctors.slice(0, TOP_DOCTOR_COUNT),
    summary: summarize(
      interpretAnalytics({
        monthly: monthlyVolume(rows, months),
        byDoctor: doctors,
        heatmap: heatmap(rows),
        outcomesByMonth: outcomesByMonth(rows, months, now),
        ratesByWeekday: ratesByWeekday(rows, now),
      }),
    ),
    appointmentActivity,
    adminActivity,
  };
}
