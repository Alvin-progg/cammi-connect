import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { DoctorsTable } from "@/components/doctors/doctors-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { parseDoctorStatusFilter } from "@/lib/doctors/params";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseDoctorAdminRepository } from "@/server/doctors/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Doctors" };

const SELECT_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-2 text-sm text-ink focus-ring";
const FILTER_LABEL_CLASS = "text-xs font-medium text-ink-muted";

export default async function AdminDoctorsPage({ searchParams }: PageProps<"/admin/doctors">) {
  const params = await searchParams;
  const session = await getAdminSession("/admin/doctors");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const departmentId = parseRecordIdParam(params.department) ?? undefined;
  const specialtyId = parseRecordIdParam(params.specialty) ?? undefined;
  const status = parseDoctorStatusFilter(params.status);

  const [departments, specialties, doctors] = await Promise.all([
    supabaseDirectoryRepository.listDepartments(),
    supabaseDirectoryRepository.listSpecialties(),
    supabaseDoctorAdminRepository.listDoctors({ departmentId, specialtyId, status }),
  ]);

  return (
    <AdminShell adminName={session.admin.fullName} active="doctors" crumbs={[{ label: "Doctors" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form
            method="get"
            action="/admin/doctors"
            aria-label="Filter doctors"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-department" className={FILTER_LABEL_CLASS}>
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
              <label htmlFor="filter-specialty" className={FILTER_LABEL_CLASS}>
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
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className={FILTER_LABEL_CLASS}>
                Status
              </label>
              <select id="filter-status" name="status" defaultValue={status} className={SELECT_CLASS}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
          <Link href="/admin/doctors/new" className={buttonVariants()}>
            New doctor
          </Link>
        </div>
        <DoctorsTable doctors={doctors} />
      </div>
    </AdminShell>
  );
}
