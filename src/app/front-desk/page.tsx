import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AccessDenied } from "@/components/auth/access-denied";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import {
  OverviewCards,
  PendingRequestsList,
  RecentActivityFeed,
  TodayScheduleList,
} from "@/components/front-desk/overview-sections";
import { SplitLayout } from "@/components/shell/staff-shell";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatManilaDate } from "@/lib/appointments/format";
import { todayInManila } from "@/lib/appointments/filters";
import { greetingFor } from "@/lib/chat/greeting";
import {
  OVERVIEW_LIST_LIMIT,
  OVERVIEW_SCHEDULE_LIMIT,
  mergeRecentActivity,
  summarizeToday,
} from "@/lib/front-desk/overview";
import { formatWaiting } from "@/lib/front-desk/requests";
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
} from "@/server/front-desk/service";

export const instant = false;

export const metadata: Metadata = { title: "Front desk" };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function SectionCard({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card aria-labelledby={id}>
      <CardHeader id={id} title={title} action={action} />
      {children}
    </Card>
  );
}

export default async function FrontDeskPage() {
  const session = await getFrontDeskSession("/front-desk");

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  const now = new Date();
  const [counts, pending, today, activity] = await Promise.all([
    getOverviewCounts(supabaseFrontDeskOverviewRepository, now),
    listPendingPreview(supabaseFrontDeskRequestsRepository),
    listDailySchedule(parseScheduleFilters({}, now), supabaseFrontDeskScheduleRepository),
    getRecentActivity(supabaseFrontDeskOverviewRepository),
  ]);

  const summary = summarizeToday(today.items, now);
  // The preview lists the oldest pending requests, so every overdue one is in
  // it unless the whole preview is overdue and more are waiting.
  const overdue = pending.filter((item) => formatWaiting(item.createdAt, now).overdue).length;
  const overdueMayBeMore = overdue === OVERVIEW_LIST_LIMIT && counts.pending > OVERVIEW_LIST_LIMIT;
  const { salutation, firstName } = greetingFor(session.staff.fullName, now);

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="overview"
      crumbs={[{ label: "Overview" }]}
      title={`${salutation}, ${firstName}`}
      lead={`${plural(counts.pending, "request needs", "requests need")} a decision. ${plural(summary.total, "patient is", "patients are")} scheduled today.`}
      requestCount={counts.pending}
      actions={
        <>
          <span className="text-sm text-ink-secondary">{`${formatManilaDate(todayInManila(now))} · Asia/Manila`}</span>
          <LinkButton size="sm" href="/front-desk/book">
            <CalendarPlus aria-hidden="true" />
            New appointment
          </LinkButton>
        </>
      }
    >
      <OverviewCards
        pending={counts.pending}
        overduePending={overdue}
        overdueMayBeMore={overdueMayBeMore}
        today={summary}
      />
      <SplitLayout
        main={
          <SectionCard
            id="overview-pending"
            title="Pending, oldest first"
            action={
              <LinkButton variant="ghost" size="sm" href="/front-desk/requests?view=list">
                All requests
              </LinkButton>
            }
          >
            <PendingRequestsList items={pending} now={now} />
          </SectionCard>
        }
        side={
          <SectionCard
            id="overview-today"
            title="Today"
            action={
              <LinkButton variant="ghost" size="sm" href="/front-desk/schedule">
                Daily schedule
              </LinkButton>
            }
          >
            <TodayScheduleList items={today.items.slice(0, OVERVIEW_SCHEDULE_LIMIT)} />
          </SectionCard>
        }
      />
      <SectionCard id="overview-activity" title="Recent activity">
        <RecentActivityFeed items={mergeRecentActivity(activity.recentConfirmed, activity.recentClosed)} />
      </SectionCard>
    </FrontDeskShell>
  );
}
