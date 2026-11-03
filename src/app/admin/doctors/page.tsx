import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { DoctorForm } from "@/components/admin/directory-forms";
import { EmptyState } from "@/components/admin/empty-state";
import { AccessDenied } from "@/components/auth/access-denied";
import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Doctors" };

const SELECT_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const SECONDARY_BUTTON_CLASS =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink pressable hover:bg-surface-muted";

export default async function AdminDoctorsPage({
  searchParams,
}: PageProps<"/admin/doctors">) {
  const params = await searchParams;
  const session = await getAdminSession("/admin/doctors");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

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
    <AdminShell
      adminName={session.admin.fullName}
      active="doctors"
      crumbs={[{ label: "Doctors" }]}
    >
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
            action="/admin/doctors"
            aria-label="Filter doctors"
            className="flex flex-wrap items-end gap-3"
          >
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
                  href={`/admin/schedules?doctor=${doctor.id}`}
                  className="self-start rounded-lg text-sm font-medium text-primary underline underline-offset-4 focus-ring hover:text-primary-hover"
                >
                  Manage {doctor.fullName}&rsquo;s schedule
                </Link>
              </div>
            ))
          )}
        </section>
      </div>
    </AdminShell>
  );
}
