import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { ServicesTable } from "@/components/services/services-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { parseServiceStatusFilter } from "@/lib/services/params";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseServiceAdminRepository } from "@/server/services/repository";
import { listServices } from "@/server/services/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";
import { CONTROL_CLASS } from "@/components/ui/field";

export const instant = false;

export const metadata: Metadata = { title: "Services" };

const FILTER_LABEL_CLASS = "text-xs font-medium text-ink-muted";

export default async function AdminServicesPage({ searchParams }: PageProps<"/admin/services">) {
  const params = await searchParams;
  const session = await getAdminSession("/admin/services");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const departmentId = parseRecordIdParam(params.department) ?? undefined;
  const status = parseServiceStatusFilter(params.status);

  const [departments, services] = await Promise.all([
    supabaseDirectoryRepository.listDepartments(),
    listServices({ departmentId, status }, supabaseServiceAdminRepository),
  ]);

  return (
    <AdminShell adminName={session.admin.fullName} active="services" crumbs={[{ label: "Services" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <form
            method="get"
            action="/admin/services"
            aria-label="Filter services"
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
                className={CONTROL_CLASS}
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
              <label htmlFor="filter-status" className={FILTER_LABEL_CLASS}>
                Status
              </label>
              <select id="filter-status" name="status" defaultValue={status} className={CONTROL_CLASS}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
          </form>
          <Link href="/admin/services/new" className={buttonVariants()}>
            New service
          </Link>
        </div>
        <ServicesTable services={services} />
      </div>
    </AdminShell>
  );
}
