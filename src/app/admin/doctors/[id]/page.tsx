import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ActiveBadge } from "@/components/ui/badge";
import { AdminShell } from "@/components/admin/admin-shell";
import { TaskCard } from "@/components/admin/form-parts";
import { AccessDenied } from "@/components/auth/access-denied";
import { DoctorAccount } from "@/components/doctors/doctor-account";
import { DoctorAppointments } from "@/components/doctors/doctor-appointments";
import { DoctorForm } from "@/components/doctors/doctor-form";
import { DoctorStatusForm } from "@/components/doctors/doctor-status";
import { DoctorTabs } from "@/components/doctors/doctor-tabs";
import { SchedulePeriodsSection } from "@/components/schedules/schedule-editor";
import { WeeklyPeriodGrid } from "@/components/schedules/weekly-period-grid";
import { todayInManila } from "@/lib/appointments/filters";
import { parseDoctorTab } from "@/lib/doctors/params";
import type { AdminDoctorDetail } from "@/lib/doctors/types";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseDoctorAdminRepository } from "@/server/doctors/repository";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import { listDoctorSchedules } from "@/server/schedules/service";
import { supabaseSettingsRepository } from "@/server/settings/repository";
import { getSettings } from "@/server/settings/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Doctor" };

export default async function AdminDoctorPage({
  params,
  searchParams,
}: PageProps<"/admin/doctors/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const session = await getAdminSession(`/admin/doctors/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const doctorId = z.uuid().safeParse(id);
  const doctor = doctorId.success
    ? await supabaseDoctorAdminRepository.getDoctor(doctorId.data)
    : null;
  if (!doctor) {
    notFound();
  }
  const tab = parseDoctorTab(query.tab);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="doctors"
      crumbs={[{ label: "Doctors", href: "/admin/doctors" }, { label: doctor.fullName }]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-ink-muted">Status</span>
          <ActiveBadge isActive={doctor.isActive} />
        </div>
        <DoctorTabs doctorId={doctor.id} active={tab} />
        {tab === "profile" ? <ProfileTab doctor={doctor} /> : null}
        {tab === "schedule" ? <ScheduleTab doctorId={doctor.id} /> : null}
        {tab === "appointments" ? <AppointmentsTab doctorId={doctor.id} /> : null}
      </div>
    </AdminShell>
  );
}

async function ProfileTab({ doctor }: { doctor: AdminDoctorDetail }) {
  const [departments, specialties, linkableAccounts] = await Promise.all([
    supabaseDirectoryRepository.listDepartments(),
    supabaseDirectoryRepository.listSpecialties(),
    doctor.hasLogin ? [] : supabaseDoctorAdminRepository.listLinkableAccounts(),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TaskCard title="Profile">
        <DoctorForm doctor={doctor} departments={departments} specialties={specialties} />
      </TaskCard>
      <div className="flex flex-col gap-6">
        <TaskCard title="Status">
          <DoctorStatusForm doctor={doctor} />
        </TaskCard>
        <TaskCard title="Account" description="The doctor's sign-in for the doctor dashboard.">
          <DoctorAccount doctor={doctor} linkableAccounts={linkableAccounts} />
        </TaskCard>
      </div>
    </div>
  );
}

/** The doctor's week at a glance, then the period editor. Exceptions stay on /admin/schedules. */
async function ScheduleTab({ doctorId }: { doctorId: string }) {
  const [schedules, settings] = await Promise.all([
    listDoctorSchedules(doctorId, supabaseDoctorSchedulesRepository),
    getSettings(supabaseSettingsRepository),
  ]);
  const today = todayInManila();
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="doctor-week-heading" className="flex flex-col gap-3">
        <h2 id="doctor-week-heading" className="text-lg font-semibold text-ink">
          Weekly overview
        </h2>
        <WeeklyPeriodGrid schedules={schedules} today={today} />
      </section>
      <SchedulePeriodsSection
        editor="admin"
        doctorId={doctorId}
        schedules={schedules}
        today={today}
        defaultSlotMinutes={settings["appointment.default_slot_minutes"]}
      />
      <Link
        href={`/admin/schedules?doctor=${doctorId}`}
        className="self-start rounded text-sm font-medium text-primary underline underline-offset-4 focus-ring"
      >
        Manage exceptions on the Schedules page
      </Link>
    </div>
  );
}

async function AppointmentsTab({ doctorId }: { doctorId: string }) {
  const appointments = await supabaseDoctorAdminRepository.listAppointmentHistory(doctorId);
  return (
    <section aria-labelledby="doctor-appointments-heading" className="flex flex-col gap-3">
      <h2 id="doctor-appointments-heading" className="text-lg font-semibold text-ink">
        Appointment history
      </h2>
      <p className="text-sm text-ink-secondary">The latest 100 appointments, newest first.</p>
      <DoctorAppointments appointments={appointments} />
    </section>
  );
}
