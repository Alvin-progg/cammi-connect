import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/admin/empty-state";
import { AccessDenied } from "@/components/auth/access-denied";
import {
  ScheduleExceptionsSection,
  SchedulePeriodsSection,
} from "@/components/schedules/schedule-editor";
import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import {
  listDoctorExceptions,
  listDoctorSchedules,
} from "@/server/schedules/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Schedules" };

/** How far ahead the admin schedule view lists exceptions. */
const EXCEPTION_WINDOW_DAYS = 180;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const SELECT_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const SECONDARY_BUTTON_CLASS =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink pressable hover:bg-surface-muted";

export default async function AdminSchedulesPage({
  searchParams,
}: PageProps<"/admin/schedules">) {
  const params = await searchParams;
  const session = await getAdminSession("/admin/schedules");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const selectedId = parseRecordIdParam(params.doctor);
  const [doctors, selected] = await Promise.all([
    supabaseDirectoryRepository.listDoctors({ activeOnly: false }),
    selectedId ? supabaseDirectoryRepository.getDoctor(selectedId) : null,
  ]);

  const picker = (
    <form
      method="get"
      action="/admin/schedules"
      aria-label="Choose a doctor"
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="schedule-doctor" className="text-xs font-medium text-ink-muted">
          Doctor
        </label>
        <select
          id="schedule-doctor"
          name="doctor"
          defaultValue={selected?.id ?? ""}
          className={SELECT_CLASS}
        >
          <option value="" disabled>
            Choose a doctor
          </option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.fullName}
              {doctor.isActive ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={SECONDARY_BUTTON_CLASS}>
        Open schedule
      </button>
    </form>
  );

  if (!selected) {
    return (
      <AdminShell
        adminName={session.admin.fullName}
        active="schedules"
        crumbs={[{ label: "Schedules" }]}
      >
        <div className="flex flex-col gap-4">
          {picker}
          <EmptyState>Choose a doctor to manage their consultation hours.</EmptyState>
        </div>
      </AdminShell>
    );
  }

  const today = todayInManila();
  const windowStart = manilaDayRange(today).start;
  const [schedules, exceptions] = await Promise.all([
    listDoctorSchedules(selected.id, supabaseDoctorSchedulesRepository),
    listDoctorExceptions(
      {
        doctorId: selected.id,
        start: windowStart,
        end: new Date(windowStart.getTime() + EXCEPTION_WINDOW_DAYS * DAY_IN_MILLISECONDS),
      },
      supabaseDoctorSchedulesRepository,
    ),
  ]);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="schedules"
      crumbs={[{ label: "Schedules", href: "/admin/schedules" }, { label: selected.fullName }]}
    >
      <div className="flex flex-col gap-8">
        {picker}
        <SchedulePeriodsSection
          editor="admin"
          doctorId={selected.id}
          schedules={schedules}
          today={today}
        />
        <ScheduleExceptionsSection
          editor="admin"
          doctorId={selected.id}
          exceptions={exceptions}
        />
      </div>
    </AdminShell>
  );
}
