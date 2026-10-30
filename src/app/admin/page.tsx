import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  DepartmentForm,
  DoctorForm,
  SpecialtyForm,
} from "@/components/admin/directory-forms";
import { AccessDenied } from "@/components/auth/access-denied";
import {
  ScheduleExceptionsSection,
  SchedulePeriodsSection,
} from "@/components/schedules/schedule-editor";
import { parseAdminView, parseRecordIdParam } from "@/lib/admin/dashboard";
import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import {
  listDoctorExceptions,
  listDoctorSchedules,
} from "@/server/schedules/service";

export const instant = false;

export const metadata: Metadata = { title: "Administration" };

type AdminSearchParams = {
  view?: string | string[];
  doctor?: string | string[];
  department?: string | string[];
  specialty?: string | string[];
};

/** How far ahead the admin schedule view lists exceptions. */
const EXCEPTION_WINDOW_DAYS = 180;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const SELECT_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const SECONDARY_BUTTON_CLASS =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted motion-reduce:transition-none";

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-sm text-ink-muted">
      {children}
    </p>
  );
}

async function DepartmentsView() {
  const departments = await supabaseDirectoryRepository.listDepartments();
  return (
    <div className="flex flex-col gap-4">
      <DepartmentForm />
      {departments.length === 0 ? (
        <EmptyState>No departments yet.</EmptyState>
      ) : (
        departments.map((department) => (
          <DepartmentForm key={department.id} department={department} />
        ))
      )}
    </div>
  );
}

async function SpecialtiesView() {
  const specialties = await supabaseDirectoryRepository.listSpecialties();
  return (
    <div className="flex flex-col gap-4">
      <SpecialtyForm />
      {specialties.length === 0 ? (
        <EmptyState>No specialties yet.</EmptyState>
      ) : (
        specialties.map((specialty) => (
          <SpecialtyForm key={specialty.id} specialty={specialty} />
        ))
      )}
    </div>
  );
}

async function DoctorsView({ params }: { params: AdminSearchParams }) {
  const departmentId = parseRecordIdParam(params.department) ?? undefined;
  const specialtyId = parseRecordIdParam(params.specialty) ?? undefined;

  const [departments, specialties, doctors, linkableAccounts] = await Promise.all([
    supabaseDirectoryRepository.listDepartments(),
    supabaseDirectoryRepository.listSpecialties(),
    supabaseDirectoryRepository.listDoctors({
      departmentId,
      specialtyId,
      activeOnly: false,
    }),
    supabaseDirectoryRepository.listLinkableAccounts(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-doctor-heading" className="flex flex-col gap-3">
        <h2 id="add-doctor-heading" className="text-xl font-semibold text-ink">
          Add a doctor
        </h2>
        <p className="text-sm leading-6 text-ink-secondary">
          Link a registered account so the doctor can sign in, or add a
          directory-only doctor without a login.
        </p>
        <DoctorForm
          departments={departments}
          specialties={specialties}
          linkableAccounts={linkableAccounts}
        />
      </section>

      <section aria-labelledby="doctor-list-heading" className="flex flex-col gap-3">
        <h2 id="doctor-list-heading" className="text-xl font-semibold text-ink">
          Doctors
        </h2>
        <form
          method="get"
          action="/admin"
          aria-label="Filter doctors"
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="view" value="doctors" />
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-department" className="text-xs font-medium text-ink-muted">
              Department
            </label>
            <select
              id="filter-department"
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
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-specialty" className="text-xs font-medium text-ink-muted">
              Specialty
            </label>
            <select
              id="filter-specialty"
              name="specialty"
              defaultValue={specialtyId ?? ""}
              className={SELECT_CLASS}
            >
              <option value="">All specialties</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={SECONDARY_BUTTON_CLASS}>
            Filter
          </button>
        </form>

        {doctors.length === 0 ? (
          <EmptyState>No doctors match these filters.</EmptyState>
        ) : (
          doctors.map((doctor) => (
            <div key={doctor.id} className="flex flex-col gap-2">
              <DoctorForm
                doctor={doctor}
                departments={departments}
                specialties={specialties}
                linkableAccounts={[]}
              />
              <Link
                href={`/admin?view=schedule&doctor=${doctor.id}`}
                className="self-start rounded-lg text-sm font-medium text-primary underline underline-offset-4 focus-ring hover:text-primary-hover"
              >
                Manage {doctor.fullName}&rsquo;s schedule
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

async function ScheduleView({ params }: { params: AdminSearchParams }) {
  const selectedId = parseRecordIdParam(params.doctor);
  const [doctors, selected] = await Promise.all([
    supabaseDirectoryRepository.listDoctors({ activeOnly: false }),
    selectedId ? supabaseDirectoryRepository.getDoctor(selectedId) : null,
  ]);

  const picker = (
    <form
      method="get"
      action="/admin"
      aria-label="Choose a doctor"
      className="flex flex-wrap items-end gap-3"
    >
      <input type="hidden" name="view" value="schedule" />
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
      <div className="flex flex-col gap-4">
        {picker}
        <EmptyState>Choose a doctor to manage their consultation hours.</EmptyState>
      </div>
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
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = await searchParams;
  const session = await getAdminSession("/admin");

  if (!session) {
    return (
      <AccessDenied message="This dashboard is only available to administrator accounts." />
    );
  }

  const view = parseAdminView(params.view);

  return (
    <AdminShell activeView={view} adminName={session.admin.fullName}>
      {view === "doctors" ? <DoctorsView params={params} /> : null}
      {view === "departments" ? <DepartmentsView /> : null}
      {view === "specialties" ? <SpecialtiesView /> : null}
      {view === "schedule" ? <ScheduleView params={params} /> : null}
    </AdminShell>
  );
}
