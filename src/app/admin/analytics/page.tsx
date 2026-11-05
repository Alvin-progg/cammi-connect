import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  DoctorRatesChart,
  DoctorVolumeChart,
  MonthlyVolumeChart,
  SlotRatesChart,
  StatusByMonthChart,
} from "@/components/analytics/analytics-charts";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { ChartCard } from "@/components/analytics/chart-card";
import { DataTable } from "@/components/analytics/data-table";
import { KpiCards } from "@/components/analytics/kpi-cards";
import { PeakHeatmap } from "@/components/analytics/peak-heatmap";
import { AccessDenied } from "@/components/auth/access-denied";
import {
  NO_DUE_MESSAGE,
  NO_VOLUME_MESSAGE,
  formatMonth,
  formatRate,
  isSmallSample,
} from "@/lib/analytics/display";
import { ANALYTICS_PATH, parseAnalyticsFilters, toAnalyticsQuery } from "@/lib/analytics/filters";
import { VOLUME_STATUSES } from "@/lib/analytics/metrics";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import { supabaseAnalyticsRepository } from "@/server/analytics/repository";
import { loadAnalytics } from "@/server/analytics/service";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Analytics" };

/** Appointment analytics: KPIs, six charts, URL filters, CSV export (spec-admin ADM-11). */
export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  const params = await searchParams;
  const session = await getAdminSession(ANALYTICS_PATH);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const filters = parseAnalyticsFilters(params);
  const [doctors, departments, analytics] = await Promise.all([
    supabaseDirectoryRepository.listDoctors({ activeOnly: false }),
    supabaseDirectoryRepository.listDepartments(),
    loadAnalytics(toAnalyticsQuery(filters), supabaseAnalyticsRepository),
  ]);

  const hasVolume = analytics.kpis.total > 0;
  const volumeEmpty = hasVolume ? null : NO_VOLUME_MESSAGE;
  const slotDue = analytics.ratesBySlot.reduce((sum, slot) => sum + slot.dueCount, 0);
  const doctorsWithDue = analytics.byDoctor.filter((doctor) => doctor.dueCount > 0);

  return (
    <AdminShell adminName={session.admin.fullName} active="analytics" crumbs={[{ label: "Analytics" }]}>
      <div className="flex flex-col gap-6">
        <AnalyticsFilters
          filters={filters}
          doctors={doctors.map((doctor) => ({ id: doctor.id, name: doctor.fullName }))}
          departments={departments.map((department) => ({ id: department.id, name: department.name }))}
        />

        <KpiCards kpis={analytics.kpis} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartCard
            id="monthly-volume"
            title="Monthly appointment volume"
            description="Appointments scheduled each month, excluding rejected requests."
            emptyMessage={volumeEmpty}
            table={
              <DataTable
                label="Monthly appointment volume data"
                columns={["Month", "Appointments"]}
                rows={analytics.monthly.map((month) => [formatMonth(month.month), month.total])}
              />
            }
          >
            <MonthlyVolumeChart data={analytics.monthly} />
          </ChartCard>

          <ChartCard
            id="doctor-volume"
            title="Appointments per doctor"
            description="Appointments scheduled with each doctor, busiest first."
            emptyMessage={volumeEmpty}
            table={
              <DataTable
                label="Appointments per doctor data"
                columns={["Doctor", "Appointments"]}
                rows={analytics.byDoctor.map((doctor) => [doctor.doctorName, doctor.total])}
              />
            }
          >
            <DoctorVolumeChart data={analytics.byDoctor} />
          </ChartCard>

          <ChartCard
            id="peak-times"
            title="Peak days and times"
            description="Appointments by weekday and two-hour start time (Manila). Darker cells are busier."
            emptyMessage={volumeEmpty}
          >
            <PeakHeatmap cells={analytics.heatmap} />
          </ChartCard>

          <ChartCard
            id="status-by-month"
            title="Status by month"
            description="Outcomes of the appointments scheduled each month. Cancellations count whenever they happened."
            emptyMessage={volumeEmpty}
            table={
              <DataTable
                label="Status by month data"
                columns={["Month", ...VOLUME_STATUSES.map((status) => APPOINTMENT_STATUS_LABELS[status])]}
                rows={analytics.statusByMonth.map((month) => [
                  formatMonth(month.month),
                  ...VOLUME_STATUSES.map((status) => month.counts[status]),
                ])}
              />
            }
          >
            <StatusByMonthChart data={analytics.statusByMonth} />
          </ChartCard>

          <ChartCard
            id="slot-rates"
            title="Cancellations and no-shows by day and time"
            description="Share of due visits in each weekday and start-time slot that were cancelled or missed."
            emptyMessage={analytics.ratesBySlot.length > 0 ? null : NO_DUE_MESSAGE}
            smallSample={isSmallSample(slotDue)}
            table={
              <DataTable
                label="Cancellations and no-shows by day and time data"
                columns={["Slot", "Due visits", "Cancellation rate", "No-show rate"]}
                rows={analytics.ratesBySlot.map((slot) => [
                  `${slot.weekday} ${slot.hourBucket}`,
                  slot.dueCount,
                  formatRate(slot.cancellationRate),
                  formatRate(slot.noShowRate),
                ])}
              />
            }
          >
            <SlotRatesChart data={analytics.ratesBySlot} />
          </ChartCard>

          <ChartCard
            id="doctor-rates"
            title="Cancellations and no-shows by doctor"
            description="Share of each doctor's due visits that were cancelled or missed."
            emptyMessage={doctorsWithDue.length > 0 ? null : NO_DUE_MESSAGE}
            smallSample={isSmallSample(analytics.kpis.dueCount)}
            table={
              <DataTable
                label="Cancellations and no-shows by doctor data"
                columns={["Doctor", "Due visits", "Cancellation rate", "No-show rate"]}
                rows={doctorsWithDue.map((doctor) => [
                  doctor.doctorName,
                  doctor.dueCount,
                  formatRate(doctor.cancellationRate),
                  formatRate(doctor.noShowRate),
                ])}
              />
            }
          >
            <DoctorRatesChart data={analytics.byDoctor} />
          </ChartCard>
        </div>

        <p className="text-sm text-ink-muted">Patterns show association, not cause.</p>
      </div>
    </AdminShell>
  );
}
