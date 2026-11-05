import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { MonitoringDetailsView } from "@/components/appointments-monitoring/monitoring-details";
import { AccessDenied } from "@/components/auth/access-denied";
import { MONITORING_PATH } from "@/lib/appointments/monitoring";
import { formatRequestId } from "@/lib/front-desk/requests";
import { supabaseAppointmentMonitoringRepository } from "@/server/appointments-monitoring/repository";
import { getMonitoredAppointment } from "@/server/appointments-monitoring/service";
import { getAdminSession } from "@/server/auth/dal";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Appointment" };

/** Read-only appointment details with the full status timeline (spec-admin ADM-09). */
export default async function AdminAppointmentPage({
  params,
}: PageProps<"/admin/appointments/[id]">) {
  const { id } = await params;
  const session = await getAdminSession(`${MONITORING_PATH}/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const appointment = await getMonitoredAppointment(id, supabaseAppointmentMonitoringRepository);
  if (!appointment) {
    notFound();
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="appointments"
      crumbs={[
        { label: "Appointments", href: MONITORING_PATH },
        { label: formatRequestId(appointment.id) },
      ]}
    >
      <MonitoringDetailsView appointment={appointment} />
    </AdminShell>
  );
}
