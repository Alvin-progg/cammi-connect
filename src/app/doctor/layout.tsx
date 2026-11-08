import { connection } from "next/server";
import { Suspense } from "react";

import { AccessDenied } from "@/components/auth/access-denied";
import { DoctorHeader } from "@/components/doctor/doctor-header";
import { DoctorShell } from "@/components/doctor/doctor-shell";
import { DoctorShellLoading } from "@/components/doctor/doctor-shell-loading";
import { NotificationsPanel } from "@/components/doctor/notifications-panel";
import { todayInManila } from "@/lib/appointments/filters";
import { formatManilaDate } from "@/lib/appointments/format";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import { getDoctorSession } from "@/server/auth/dal";
import { supabaseDoctorNotificationsRepository } from "@/server/notifications/repository";
import {
  countUnreadDoctorNotifications,
  listDoctorNotifications,
  listUpcomingReminders,
} from "@/server/notifications/service";
import { getDoctorProfileDetails } from "@/server/profiles/service";

async function NotificationsModalPanel({ doctorId }: { doctorId: string }) {
  const [notifications, reminders] = await Promise.all([
    listDoctorNotifications(doctorId, supabaseDoctorNotificationsRepository),
    listUpcomingReminders({ doctorId }, supabaseDoctorAppointmentsRepository),
  ]);
  return <NotificationsPanel notifications={notifications} reminders={reminders} />;
}

/**
 * Rail and header for every doctor view. As a layout it stays mounted while
 * the doctor moves between view routes, so only the page body reloads. Each
 * page still runs its own session guard; this one only decides what to show.
 */
async function DoctorWorkspace({ children }: { children: React.ReactNode }) {
  await connection();
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return <AccessDenied />;
  }

  const doctorId = session.doctor.id;
  const [details, unreadCount] = await Promise.all([
    getDoctorProfileDetails(doctorId),
    countUnreadDoctorNotifications(doctorId, supabaseDoctorNotificationsRepository),
  ]);
  const specialty = details?.specialty ?? null;

  return (
    <DoctorShell
      doctorName={session.doctor.fullName}
      specialty={specialty}
      notificationsPanel={<NotificationsModalPanel doctorId={doctorId} />}
    >
      <DoctorHeader
        todayLabel={formatManilaDate(todayInManila())}
        unreadCount={unreadCount}
        doctorName={session.doctor.fullName}
        specialty={specialty}
      />
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </DoctorShell>
  );
}

export default function DoctorLayout({ children }: LayoutProps<"/doctor">) {
  // The root layout has no Suspense around children, and the shell reads the session.
  return (
    <Suspense fallback={<DoctorShellLoading />}>
      <DoctorWorkspace>{children}</DoctorWorkspace>
    </Suspense>
  );
}
