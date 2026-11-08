import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  AppointmentActivity,
  DoctorPerformance,
  PendingOverview,
  SystemActivity,
} from "@/components/admin-dashboard/dashboard-sections";
import { DashboardFilters } from "@/components/admin-dashboard/dashboard-filters";
import { SummaryCards } from "@/components/admin-dashboard/summary-cards";
import { DailyActivityChart, StatusDistributionChart } from "@/components/analytics/analytics-charts";
import { ChartCard } from "@/components/analytics/chart-card";
import { DataTable } from "@/components/analytics/data-table";
import { AccessDenied } from "@/components/auth/access-denied";
import { DASHBOARD_PATH, parseDashboardFilters, toDashboardQuery } from "@/lib/admin/dashboard";
import { NO_VOLUME_MESSAGE, formatDay } from "@/lib/analytics/display";
import { VOLUME_STATUSES } from "@/lib/analytics/metrics";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import { supabaseAnalyticsRepository } from "@/server/analytics/repository";
import { loadDashboard } from "@/server/analytics/service";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "./_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Administration" };

/** Admin dashboard: operations overview with URL filters (spec-admin ADM-12). */
export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const params = await searchParams;
  const session = await getAdminSession(DASHBOARD_PATH);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const filters = parseDashboardFilters(params);
  const [doctors, departments, dashboard] = await Promise.all([
    supabaseDirectoryRepository.listDoctors({ activeOnly: false }),
    supabaseDirectoryRepository.listDepartments(),
    loadDashboard(toDashboardQuery(filters), supabaseAnalyticsRepository),
  ]);

  const volumeEmpty = dashboard.cards.total > 0 ? null : NO_VOLUME_MESSAGE;

  return (
    <AdminShell adminName={session.admin.fullName} active="dashboard" crumbs={[{ label: "Dashboard" }]}>
      <div className="flex flex-col gap-6">
        <DashboardFilters
          filters={filters}
          doctors={doctors.map((doctor) => ({ id: doctor.id, name: doctor.fullName }))}
          departments={departments.map((department) => ({ id: department.id, name: department.name }))}
        />

        <SummaryCards
          filters={filters}
          cards={dashboard.cards}
          pending={dashboard.pending.count}
          trendPercent={dashboard.trend.percent}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartCard
            id="daily-activity"
            title="Appointment activity"
            description="Appointments scheduled each day in range, excluding rejected requests."
            emptyMessage={volumeEmpty}
            table={
              <DataTable
                label="Appointment activity data"
                columns={["Day", "Appointments"]}
                rows={dashboard.daily.map((day) => [formatDay(day.date), day.total])}
              />
            }
          >
            <DailyActivityChart data={dashboard.daily} />
          </ChartCard>

          <ChartCard
            id="status-distribution"
            title="Status distribution"
            description="Current status of the appointments scheduled in range."
            emptyMessage={volumeEmpty}
            table={
              <DataTable
                label="Status distribution data"
                columns={["Status", "Appointments"]}
                rows={VOLUME_STATUSES.map((status) => [
                  APPOINTMENT_STATUS_LABELS[status],
                  dashboard.statusDistribution[status],
                ])}
              />
            }
          >
            <StatusDistributionChart data={dashboard.statusDistribution} />
          </ChartCard>

          <DoctorPerformance doctors={dashboard.topDoctors} />
          <PendingOverview pending={dashboard.pending} />
          <AppointmentActivity entries={dashboard.appointmentActivity} />
          <SystemActivity entries={dashboard.adminActivity} />
        </div>
      </div>
    </AdminShell>
  );
}
