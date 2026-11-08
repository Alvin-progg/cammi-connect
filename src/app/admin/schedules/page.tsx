import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import {
  ScheduleExceptionsSection,
  SchedulePeriodsSection,
} from "@/components/schedules/schedule-editor";
import { SchedulesOverview } from "@/components/schedules/schedules-overview";
import { Button } from "@/components/ui/button";
import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import {
  listDoctorExceptions,
  listDoctorSchedules,
} from "@/server/schedules/service";
import { supabaseSettingsRepository } from "@/server/settings/repository";
import { getSettings } from "@/server/settings/service";

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
    const departmentId = parseRecordIdParam(params.department) ?? undefined;
    const [departments, listedDoctors] = await Promise.all([
      supabaseDirectoryRepository.listDepartments(),
      departmentId
        ? supabaseDirectoryRepository.listDoctors({ departmentId, activeOnly: false })
        : doctors,
    ]);
    const schedules = await supabaseDoctorSchedulesRepository.listSchedulesForDoctors(
      listedDoctors.map((doctor) => doctor.id),
    );

    return (
      <AdminShell
        adminName={session.admin.fullName}
        active="schedules"
        crumbs={[{ label: "Schedules" }]}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {picker}
            <Link href="/admin/schedules/exceptions" className={SECONDARY_BUTTON_CLASS}>
              Hospital holidays
            </Link>
          </div>
          <form
            method="get"
            action="/admin/schedules"
            aria-label="Filter schedules"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="schedule-department" className="text-xs font-medium text-ink-muted">
                Department
              </label>
              <select
                id="schedule-department"
                name="department"
                defaultValue={departmentId ?? ""}
                className={SELECT_CLASS}
              >
                <option value="">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
          <SchedulesOverview
            doctors={listedDoctors}
            schedules={schedules}
            today={todayInManila()}
          />
        </div>
      </AdminShell>
    );
  }

  const today = todayInManila();
  const windowStart = manilaDayRange(today).start;
  const [schedules, exceptions, settings] = await Promise.all([
    listDoctorSchedules(selected.id, supabaseDoctorSchedulesRepository),
    listDoctorExceptions(
      {
        doctorId: selected.id,
        start: windowStart,
        end: new Date(windowStart.getTime() + EXCEPTION_WINDOW_DAYS * DAY_IN_MILLISECONDS),
      },
      supabaseDoctorSchedulesRepository,
    ),
    getSettings(supabaseSettingsRepository),
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
          defaultSlotMinutes={settings["appointment.default_slot_minutes"]}
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
