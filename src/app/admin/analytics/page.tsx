import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  DoctorRatesChart,
  DoctorVolumeChart,
  MonthlyVolumeChart,
  OutcomesChart,
  SERIES,
  WeekdayRatesChart,
} from "@/components/analytics/analytics-charts";
import { AnalyticsExportMenu, AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { ChartCard, ChartLegend, ChartSection } from "@/components/analytics/chart-card";
import { DataTable } from "@/components/analytics/data-table";
import { KpiCards } from "@/components/analytics/kpi-cards";
import { PeakHeatmap } from "@/components/analytics/peak-heatmap";
import { AccessDenied } from "@/components/auth/access-denied";
import {
  NO_OUTCOME_MESSAGE,
  NO_VOLUME_MESSAGE,
  formatMonth,
  formatMonthRange,
  formatRate,
  isSmallSample,
} from "@/lib/analytics/display";
import {
  ANALYTICS_PATH,
  ANALYTICS_RANGE_LABELS,
  parseAnalyticsFilters,
  toAnalyticsQuery,
  type AnalyticsRange,
} from "@/lib/analytics/filters";
import {
  doctorRatesTakeaway,
  doctorTakeaway,
  heatmapTakeaway,
  monthlyTakeaway,
  outcomesTakeaway,
  weekdayRatesTakeaway,
} from "@/lib/analytics/takeaways";
import { formatManilaMediumDate } from "@/lib/appointments/format";
import { supabaseAnalyticsRepository } from "@/server/analytics/repository";
import { loadAnalytics } from "@/server/analytics/service";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Analytics" };

/** How the first KPI names the period: "Appointments this year". */
const PERIOD_PHRASES: Record<AnalyticsRange, string> = {
  this_year: "this year",
  this_month: "this month",
  last_3_months: "in the last 3 months",
  last_12_months: "in the last 12 months",
  custom: "in this period",
};

/**
 * Appointment analytics in the reference design (spec-admin ADM-11, metric
 * definitions v2 in docs/analytics-definitions.md): KPIs, Demand and Outcomes
 * charts with data-written takeaways, URL filters, and CSV export.
 */
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

  const { kpis } = analytics;
  const volumeEmpty = kpis.total > 0 ? null : NO_VOLUME_MESSAGE;
  const outcomeEmpty = kpis.outcomeCount > 0 ? null : NO_OUTCOME_MESSAGE;
  const doctorsWithOutcomes = analytics.byDoctor.filter((doctor) => doctor.outcomeCount > 0);
  const outcomeMonths = kpis.outcomeMonths ? formatMonthRange(kpis.outcomeMonths.first, kpis.outcomeMonths.last) : null;
  const period = `${ANALYTICS_RANGE_LABELS[filters.range]}, ${formatManilaMediumDate(filters.from)} – ${formatManilaMediumDate(filters.to)}`;

  const outcomesLegend = (
    <ChartLegend
      items={[
        { label: "Completed", color: SERIES.completed },
        { label: "Cancelled", color: SERIES.cancelled },
        { label: "No-show", color: SERIES.noShow },
      ]}
    />
  );
  const ratesLegend = (
    <ChartLegend
      items={[
        { label: "Cancellation rate", color: SERIES.cancelled },
        { label: "No-show rate", color: SERIES.noShow },
      ]}
    />
  );
  const caption = (text: string) => <span className="text-xs text-ink-muted">{text}</span>;

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="analytics"
      crumbs={[{ label: "Analytics" }]}
      lead={`Appointment volume, doctor workload, peak hours and outcomes · ${period} · Times in Asia/Manila`}
      actions={<AnalyticsExportMenu filters={filters} />}
    >
      <div className="flex flex-col gap-6">
        <AnalyticsFilters
          filters={filters}
          doctors={doctors.map((doctor) => ({ id: doctor.id, name: doctor.fullName }))}
          departments={departments.map((department) => ({ id: department.id, name: department.name }))}
        />

        <KpiCards kpis={kpis} periodLabel={PERIOD_PHRASES[filters.range]} />

        <ChartSection title="Demand" description="How many appointments, with whom, and when" />
        <ChartCard
          id="monthly-volume"
          number={1}
          title="Monthly appointment volume"
          description={monthlyTakeaway(analytics.monthly) ?? "Appointments scheduled each month, excluding rejected requests."}
          aside={caption("Appointments per month")}
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            id="doctor-volume"
            number={2}
            title="Appointments per doctor"
            description={doctorTakeaway(analytics.byDoctor) ?? "Appointments scheduled with each doctor, busiest first."}
            aside={caption(ANALYTICS_RANGE_LABELS[filters.range])}
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
            number={3}
            title="Peak consultation days and times"
            description={
              heatmapTakeaway(analytics.heatmap.cells) ??
              "Appointments by weekday and two-hour daytime slot (Manila). Darker cells are busier."
            }
            aside={caption("Appointments per slot")}
            emptyMessage={volumeEmpty}
          >
            <PeakHeatmap heatmap={analytics.heatmap} />
          </ChartCard>
        </div>

        <ChartSection title="Outcomes" description="What happened to booked appointments" />
        <ChartCard
          id="outcomes"
          number={4}
          title="Monthly appointment outcomes"
          description={
            outcomesTakeaway(analytics.outcomesByMonth) ??
            "Completed, cancelled, and missed visits per month, for visits that have finished."
          }
          aside={outcomesLegend}
          emptyMessage={outcomeEmpty}
          smallSample={isSmallSample(kpis.outcomeCount)}
          table={
            <DataTable
              label="Monthly appointment outcomes data"
              columns={["Month", "Completed", "Cancelled", "No-show"]}
              rows={analytics.outcomesByMonth.map((month) => [
                formatMonth(month.month),
                month.completed,
                month.cancelled,
                month.noShow,
              ])}
            />
          }
        >
          <OutcomesChart data={analytics.outcomesByMonth} />
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            id="weekday-rates"
            number={5}
            title="Cancellation and no-show rate by weekday"
            description={
              weekdayRatesTakeaway(analytics.ratesByWeekday) ??
              "Share of each weekday's finished visits that were cancelled or missed."
            }
            aside={ratesLegend}
            emptyMessage={outcomeEmpty}
            smallSample={isSmallSample(kpis.outcomeCount)}
            table={
              <DataTable
                label="Cancellation and no-show rate by weekday data"
                columns={["Weekday", "Finished visits", "Cancellation rate", "No-show rate"]}
                rows={analytics.ratesByWeekday.map((day) => [
                  day.weekday,
                  day.outcomeCount,
                  formatRate(day.cancellationRate),
                  formatRate(day.noShowRate),
                ])}
              />
            }
          >
            <WeekdayRatesChart data={analytics.ratesByWeekday} />
          </ChartCard>

          <ChartCard
            id="doctor-rates"
            number={6}
            title="Cancellation and no-show rate by doctor"
            description={
              doctorRatesTakeaway(analytics.byDoctor) ??
              "Share of each doctor's finished visits that were cancelled or missed."
            }
            aside={ratesLegend}
            emptyMessage={doctorsWithOutcomes.length > 0 ? null : NO_OUTCOME_MESSAGE}
            smallSample={isSmallSample(kpis.outcomeCount)}
            table={
              <DataTable
                label="Cancellation and no-show rate by doctor data"
                columns={["Doctor", "Finished visits", "Cancellation rate", "No-show rate"]}
                rows={doctorsWithOutcomes.map((doctor) => [
                  doctor.doctorName,
                  doctor.outcomeCount,
                  formatRate(doctor.cancellationRate),
                  formatRate(doctor.noShowRate),
                ])}
              />
            }
          >
            <DoctorRatesChart data={analytics.byDoctor} />
          </ChartCard>
        </div>

        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          {outcomeMonths ? <p>{`Outcome figures cover visits that finished in ${outcomeMonths}.`}</p> : null}
          <p>Patterns show association, not cause.</p>
        </div>
      </div>
    </AdminShell>
  );
}
