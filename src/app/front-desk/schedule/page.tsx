import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/auth/access-denied";
import { DailySchedule } from "@/components/front-desk/daily-schedule";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PrintButton } from "@/components/front-desk/print-button";
import { LinkButton } from "@/components/ui/button";
import { todayInManila } from "@/lib/appointments/filters";
import { formatManilaDate } from "@/lib/appointments/format";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
} from "@/lib/appointments/status";
import {
  SCHEDULE_SEARCH_MAX_LENGTH,
  parseScheduleFilters,
  shiftManilaDate,
} from "@/lib/front-desk/schedule";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseFrontDeskScheduleRepository } from "@/server/front-desk/repository";
import { listDailySchedule } from "@/server/front-desk/service";
import { CONTROL_CLASS } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export const instant = false;

export const metadata: Metadata = { title: "Daily schedule" };

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const SECONDARY_BUTTON_CLASS = buttonVariants({ variant: "outline", size: "sm" });

export default async function FrontDeskSchedulePage({
  searchParams,
}: PageProps<"/front-desk/schedule">) {
  const params = await searchParams;
  const session = await getFrontDeskSession("/front-desk/schedule");

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to front desk staff." />
    );
  }

  const now = new Date();
  const filters = parseScheduleFilters(params, now);
  const [schedule, doctors] = await Promise.all([
    listDailySchedule(filters, supabaseFrontDeskScheduleRepository),
    supabaseDirectoryRepository.listDoctors({ activeOnly: false }),
  ]);

  const items = schedule.items;
  const checkedIn = items.filter((item) => item.status === "checked_in").length;
  const noShows = items.filter((item) => item.status === "no_show").length;

  // Day links keep the other filters.
  function dayHref(date: string): string {
    const query = new URLSearchParams({ date });
    if (filters.doctorId) query.set("doctor", filters.doctorId);
    if (filters.status !== "all") query.set("status", filters.status);
    if (filters.search) query.set("q", filters.search);
    return `/front-desk/schedule?${query.toString()}`;
  }

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="schedule"
      crumbs={[{ label: "Daily schedule" }]}
      title={formatManilaDate(filters.date)}
      lead={`${items.length === 1 ? "1 appointment" : `${items.length} appointments`} · ${checkedIn} checked in · ${noShows} no-show. Record check-in, completion, or no-show from the appointment day onward.`}
      actions={
        <>
          <LinkButton variant="outline" size="icon" href={dayHref(shiftManilaDate(filters.date, -1))} aria-label="Previous day">
            <ChevronLeft aria-hidden="true" />
          </LinkButton>
          <form method="get" action="/front-desk/schedule" aria-label="Go to date" className="flex gap-2">
            {filters.doctorId ? <input type="hidden" name="doctor" value={filters.doctorId} /> : null}
            {filters.status !== "all" ? <input type="hidden" name="status" value={filters.status} /> : null}
            {filters.search ? <input type="hidden" name="q" value={filters.search} /> : null}
            <label htmlFor="schedule-date" className="sr-only">
              Date
            </label>
            <input
              id="schedule-date"
              type="date"
              name="date"
              defaultValue={filters.date}
              className={cn(CONTROL_CLASS, "w-auto")}
            />
            <button type="submit" className={SECONDARY_BUTTON_CLASS}>
              Go
            </button>
          </form>
          <LinkButton variant="outline" size="icon" href={dayHref(shiftManilaDate(filters.date, 1))} aria-label="Next day">
            <ChevronRight aria-hidden="true" />
          </LinkButton>
          <LinkButton variant="outline" size="sm" href={dayHref(todayInManila(now))}>
            Today
          </LinkButton>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <form
          method="get"
          action="/front-desk/schedule"
          aria-label="Filter schedule"
          className="flex flex-wrap items-end gap-3 print:hidden"
        >
          <input type="hidden" name="date" value={filters.date} />
          <div className="flex flex-col gap-1">
            <label htmlFor="schedule-doctor" className={FIELD_LABEL_CLASS}>
              Doctor
            </label>
            <select
              id="schedule-doctor"
              name="doctor"
              defaultValue={filters.doctorId ?? ""}
              className={CONTROL_CLASS}
            >
              <option value="">All doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="schedule-status" className={FIELD_LABEL_CLASS}>
              Status
            </label>
            <select
              id="schedule-status"
              name="status"
              defaultValue={filters.status}
              className={CONTROL_CLASS}
            >
              <option value="all">All statuses</option>
              {APPOINTMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPOINTMENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="schedule-search" className={FIELD_LABEL_CLASS}>
              Patient name
            </label>
            <input
              id="schedule-search"
              type="search"
              name="q"
              maxLength={SCHEDULE_SEARCH_MAX_LENGTH}
              defaultValue={filters.search ?? ""}
              className={CONTROL_CLASS}
            />
          </div>
          <button type="submit" className={SECONDARY_BUTTON_CLASS}>
            Filter
          </button>
          <Link
            href={`/front-desk/schedule?date=${filters.date}`}
            className="focus-ring inline-flex h-9 items-center rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline"
          >
            Clear filters
          </Link>
          <div className="ml-auto">
            <PrintButton />
          </div>
        </form>
        <DailySchedule
          items={schedule.items}
          limitReached={schedule.limitReached}
          now={now}
        />
      </div>
    </FrontDeskShell>
  );
}
