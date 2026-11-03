import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AccessDenied } from "@/components/auth/access-denied";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { OverviewCards } from "@/components/front-desk/overview-cards";
import {
  AppointmentSearchResults,
  PendingRequestsList,
  RecentActivityList,
  TodayScheduleList,
} from "@/components/front-desk/overview-sections";
import { Button } from "@/components/ui/button";
import {
  OVERVIEW_SCHEDULE_LIMIT,
  OVERVIEW_SEARCH_MAX_LENGTH,
  parseOverviewSearch,
} from "@/lib/front-desk/overview";
import { parseScheduleFilters } from "@/lib/front-desk/schedule";
import { getFrontDeskSession } from "@/server/auth/dal";
import {
  supabaseFrontDeskOverviewRepository,
  supabaseFrontDeskRequestsRepository,
  supabaseFrontDeskScheduleRepository,
} from "@/server/front-desk/repository";
import {
  getOverviewCounts,
  getRecentActivity,
  listDailySchedule,
  listPendingPreview,
  searchAppointments,
} from "@/server/front-desk/service";

export const instant = false;

export const metadata: Metadata = { title: "Front desk" };

const CONTROL_CLASS =
  "min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-sm text-ink focus-ring sm:w-80";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function FrontDeskPage({ searchParams }: PageProps<"/front-desk">) {
  const params = await searchParams;
  const session = await getFrontDeskSession("/front-desk");

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  const now = new Date();
  const query = parseOverviewSearch(params);
  const [counts, pending, today, activity, search] = await Promise.all([
    getOverviewCounts(supabaseFrontDeskOverviewRepository, now),
    listPendingPreview(supabaseFrontDeskRequestsRepository),
    listDailySchedule(parseScheduleFilters({}, now), supabaseFrontDeskScheduleRepository),
    getRecentActivity(supabaseFrontDeskOverviewRepository),
    query ? searchAppointments(query, supabaseFrontDeskOverviewRepository) : null,
  ]);

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="overview"
      crumbs={[{ label: "Overview" }]}
    >
      <div className="flex flex-col gap-8">
        <form
          method="get"
          action="/front-desk"
          role="search"
          aria-label="Quick appointment search"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex w-full flex-col gap-1 sm:w-auto">
            <label htmlFor="overview-search" className="text-xs font-medium text-ink-muted">
              Patient name or phone
            </label>
            <input
              id="overview-search"
              type="search"
              name="q"
              maxLength={OVERVIEW_SEARCH_MAX_LENGTH}
              defaultValue={query ?? ""}
              className={CONTROL_CLASS}
            />
          </div>
          <Button type="submit" variant="secondary">
            Search appointments
          </Button>
        </form>

        {query && search ? (
          <Section id="overview-search-results" title="Search results">
            <AppointmentSearchResults query={query} result={search} />
          </Section>
        ) : null}

        <OverviewCards counts={counts} />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Section id="overview-pending" title="Pending requests">
            <PendingRequestsList items={pending} total={counts.pending} />
          </Section>
          <Section id="overview-today" title="Today's schedule">
            <TodayScheduleList
              items={today.items.slice(0, OVERVIEW_SCHEDULE_LIMIT)}
              total={today.items.length}
            />
          </Section>
          <Section id="overview-confirmed" title="Recently confirmed">
            <RecentActivityList
              label="Recently confirmed"
              items={activity.recentConfirmed}
              emptyMessage="No appointments have been confirmed yet."
            />
          </Section>
          <Section id="overview-closed" title="Recently rejected or cancelled">
            <RecentActivityList
              label="Recently rejected or cancelled"
              items={activity.recentClosed}
              emptyMessage="No appointments have been rejected or cancelled yet."
            />
          </Section>
        </div>
      </div>
    </FrontDeskShell>
  );
}
