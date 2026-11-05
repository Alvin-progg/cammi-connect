import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  MonitoringFilters,
  MonitoringTable,
} from "@/components/appointments-monitoring/monitoring-list";
import { AccessDenied } from "@/components/auth/access-denied";
import { parseAppointmentMonitoringFilters } from "@/lib/appointments/monitoring";
import { supabaseAppointmentMonitoringRepository } from "@/server/appointments-monitoring/repository";
import { listMonitoredAppointments } from "@/server/appointments-monitoring/service";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Appointments" };

/** System-wide, read-only appointment monitoring (spec-admin ADM-09). */
export default async function AdminAppointmentsPage({
  searchParams,
}: PageProps<"/admin/appointments">) {
  const params = await searchParams;
  const session = await getAdminSession("/admin/appointments");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const filters = parseAppointmentMonitoringFilters(params);
  const [doctors, departments, { items, total, page, pageCount }] = await Promise.all([
    supabaseDirectoryRepository.listDoctors({ activeOnly: false }),
    supabaseDirectoryRepository.listDepartments(),
    listMonitoredAppointments(filters, supabaseAppointmentMonitoringRepository),
  ]);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="appointments"
      crumbs={[{ label: "Appointments" }]}
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-ink-secondary">
          Read-only. Confirmations, cancellations, and reschedules are handled by the front desk.
        </p>
        <MonitoringFilters
          filters={filters}
          doctors={doctors.map((doctor) => ({ id: doctor.id, name: doctor.fullName }))}
          departments={departments.map((department) => ({ id: department.id, name: department.name }))}
        />
        <MonitoringTable
          items={items}
          total={total}
          page={page}
          pageCount={pageCount}
          filters={filters}
        />
      </div>
    </AdminShell>
  );
}
