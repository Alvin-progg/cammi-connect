import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AccessDenied } from "@/components/auth/access-denied";
import { AppointmentsCard } from "@/components/doctor/appointments-card";
import { toHistoryItems } from "@/components/doctor/history-items";
import { WeekSchedule } from "@/components/doctor/week-schedule";
import {
  legacyDoctorViewPath,
  parseAppointmentStatusFilter,
  parseWeekStart,
  shiftWeek,
} from "@/lib/appointments/dashboard";
import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import { buildWeekLayout } from "@/lib/appointments/week";
import { formatScheduleSummary } from "@/lib/schedules/types";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import {
  getAppointmentHistoryMap,
  listDoctorAppointmentsInRange,
} from "@/server/appointments/service";
import { getDoctorSession } from "@/server/auth/dal";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import { listDoctorSchedules } from "@/server/schedules/service";

export const instant = false;

export const metadata: Metadata = { title: "Doctor dashboard" };

type DoctorSearchParams = Record<string, string | string[] | undefined>;

function appointmentCountLabel(count: number, description: string): string {
  return count === 0
    ? `No appointments · ${description}`
    : `${count} appointment${count === 1 ? "" : "s"} · ${description}`;
}

async function AppointmentsWorkspace({
  doctorId,
  params,
}: {
  doctorId: string;
  params: DoctorSearchParams;
}) {
  const status = parseAppointmentStatusFilter(params.status);
  const weekStart = parseWeekStart(params.week);
  const currentWeekStart = parseWeekStart(undefined);

  const [appointments, schedules] = await Promise.all([
    listDoctorAppointmentsInRange(
      {
        doctorId,
        start: manilaDayRange(weekStart).start,
        end: manilaDayRange(shiftWeek(weekStart, 1)).start,
        status,
      },
      supabaseDoctorAppointmentsRepository,
    ),
    listDoctorSchedules(doctorId, supabaseDoctorSchedulesRepository),
  ]);
  const historyMap = await getAppointmentHistoryMap(
    { appointmentIds: appointments.map((appointment) => appointment.id) },
    supabaseDoctorAppointmentsRepository,
  );
  const scheduleHint = formatScheduleSummary(schedules, todayInManila());

  return (
    <AppointmentsCard
      weekStart={weekStart}
      currentWeekStart={currentWeekStart}
      status={status}
      summary={appointmentCountLabel(
        appointments.length,
        weekStart === currentWeekStart ? "This week" : "Selected week",
      )}
    >
      <WeekSchedule
        layout={buildWeekLayout({ weekStart, appointments })}
        historyById={Object.fromEntries(
          appointments.map((appointment) => [
            appointment.id,
            toHistoryItems(historyMap.get(appointment.id)),
          ]),
        )}
        scheduleHint={scheduleHint}
      />
    </AppointmentsCard>
  );
}

export default async function DoctorWeekPage({
  searchParams,
}: {
  searchParams: Promise<DoctorSearchParams>;
}) {
  await connection();
  const params = await searchParams;
  // Old `/doctor?view=` links (bookmarks, emails) land on the view's route.
  const legacyPath = legacyDoctorViewPath(params);
  if (legacyPath) {
    redirect(legacyPath);
  }

  // Each page guards itself; the layout's check only decides what it shows.
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return <AccessDenied />;
  }
  const doctorId = session.doctor.id;

  return <AppointmentsWorkspace doctorId={doctorId} params={params} />;
}
