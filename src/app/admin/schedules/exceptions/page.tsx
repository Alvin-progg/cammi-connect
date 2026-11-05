import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { ScheduleExceptionsSection } from "@/components/schedules/schedule-editor";
import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import { listHospitalHolidays } from "@/server/schedules/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Hospital holidays" };

/** How far ahead the holidays page lists holidays. */
const HOLIDAY_WINDOW_DAYS = 365;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/** Hospital-wide holidays (spec-admin ADM-06); each one closes booking for every doctor. */
export default async function AdminHospitalHolidaysPage() {
  const session = await getAdminSession("/admin/schedules/exceptions");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const windowStart = manilaDayRange(todayInManila()).start;
  const holidays = await listHospitalHolidays(
    {
      start: windowStart,
      end: new Date(windowStart.getTime() + HOLIDAY_WINDOW_DAYS * DAY_IN_MILLISECONDS),
    },
    supabaseDoctorSchedulesRepository,
  );

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="schedules"
      crumbs={[
        { label: "Schedules", href: "/admin/schedules" },
        { label: "Hospital holidays" },
      ]}
    >
      <ScheduleExceptionsSection editor="holiday" exceptions={holidays} />
    </AdminShell>
  );
}
