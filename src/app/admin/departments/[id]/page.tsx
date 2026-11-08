import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActiveBadge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { EmptyState } from "@/components/ui/data";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import { DepartmentForm } from "@/components/departments/department-form";
import { DepartmentStatusForm } from "@/components/departments/department-status";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
} from "@/lib/appointments/status";
import { DEPARTMENT_STATS_WINDOW_DAYS } from "@/lib/departments/types";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDepartmentAdminRepository } from "@/server/departments/repository";
import { getDepartmentDetail } from "@/server/departments/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Department" };

export default async function AdminDepartmentPage({
  params,
}: PageProps<"/admin/departments/[id]">) {
  const { id } = await params;
  const session = await getAdminSession(`/admin/departments/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const departmentId = z.uuid().safeParse(id);
  const detail = departmentId.success
    ? await getDepartmentDetail(departmentId.data, supabaseDepartmentAdminRepository)
    : null;
  if (!detail) {
    notFound();
  }

  const { department, doctors, statusCounts } = detail;

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="departments"
      crumbs={[{ label: "Departments", href: "/admin/departments" }, { label: department.name }]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">Status</span>
          <ActiveBadge isActive={department.isActive} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <TaskCard title="Details">
            <DepartmentForm department={department} />
          </TaskCard>
          <TaskCard title="Status">
            <DepartmentStatusForm department={department} />
          </TaskCard>
          <TaskCard title="Doctors" description="Doctors assigned to this department.">
            {doctors.length === 0 ? (
              <EmptyState>No doctors are assigned yet.</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-line text-sm">
                {doctors.map((doctor) => (
                  <li key={doctor.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-ink">{doctor.fullName}</span>
                    <ActiveBadge isActive={doctor.isActive} />
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/admin/doctors?department=${department.id}`}
              className="self-start rounded text-sm font-medium text-primary underline underline-offset-4 focus-ring"
            >
              Manage doctors
            </Link>
          </TaskCard>
          <TaskCard
            title="Appointments"
            description={`Scheduled in the last ${DEPARTMENT_STATS_WINDOW_DAYS} days, by status.`}
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {APPOINTMENT_STATUSES.map((status) => (
                <div key={status} className="flex justify-between gap-3">
                  <dt className="text-ink-secondary">{APPOINTMENT_STATUS_LABELS[status]}</dt>
                  <dd className="font-medium tabular-nums text-ink">{statusCounts[status] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </TaskCard>
        </div>
      </div>
    </AdminShell>
  );
}
