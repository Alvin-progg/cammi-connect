import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/auth/access-denied";
import { DailySchedule } from "@/components/front-desk/daily-schedule";
import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";
import { buttonVariants } from "@/components/ui/button";
import { formatManilaMediumDate } from "@/lib/appointments/format";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
} from "@/lib/appointments/status";
import {
  SCHEDULE_SEARCH_MAX_LENGTH,
  parseScheduleFilters,
} from "@/lib/front-desk/schedule";
import { getFrontDeskSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseFrontDeskScheduleRepository } from "@/server/front-desk/repository";
import { listDailySchedule } from "@/server/front-desk/service";

export const instant = false;

export const metadata: Metadata = { title: "Daily schedule" };

const FIELD_LABEL_CLASS = "text-xs font-medium text-ink-muted";
const CONTROL_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const SECONDARY_BUTTON_CLASS = buttonVariants({ variant: "secondary" });

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

  return (
    <FrontDeskShell
      staffName={session.staff.fullName}
      active="schedule"
      crumbs={[{ label: "Daily schedule" }]}
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm leading-6 text-ink-secondary">
          {`Appointments on ${formatManilaMediumDate(filters.date)} from every booking source. Record check-in, completion, or no-show from the appointment day onward.`}
        </p>
        <form
          method="get"
          action="/front-desk/schedule"
          aria-label="Filter schedule"
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="schedule-date" className={FIELD_LABEL_CLASS}>
              Date
            </label>
            <input
              id="schedule-date"
              type="date"
              name="date"
              defaultValue={filters.date}
              className={CONTROL_CLASS}
            />
          </div>
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
            href="/front-desk/schedule"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline"
          >
            Clear filters
          </Link>
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
