import type { Metadata } from "next";
import { connection } from "next/server";

import { AccessDenied } from "@/components/auth/access-denied";
import { ScheduleManager } from "@/components/doctor/schedule-manager";
import { parseCalendarMonth, shiftCalendarMonth } from "@/lib/appointments/dashboard";
import { manilaDayRange, todayInManila } from "@/lib/appointments/filters";
import { manilaDateOfTimestamp } from "@/lib/appointments/stats";
import type { AppointmentStatus } from "@/lib/appointments/status";
import { buildMonthGrid, summarizeBlocksByDate } from "@/lib/schedules/calendar";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import { listDoctorAppointmentsInRange } from "@/server/appointments/service";
import { getDoctorSession } from "@/server/auth/dal";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import { listDoctorExceptions, listDoctorSchedules } from "@/server/schedules/service";
import { supabaseSettingsRepository } from "@/server/settings/repository";
import { getSettings } from "@/server/settings/service";

export const instant = false;

export const metadata: Metadata = { title: "Availability" };

type DoctorSearchParams = Record<string, string | string[] | undefined>;

async function CalendarWorkspace({ doctorId, params }: { doctorId: string; params: DoctorSearchParams }) {
  const month = parseCalendarMonth(params.month);
  const monthStart = manilaDayRange(`${month}-01`).start;
  const monthEnd = manilaDayRange(`${shiftCalendarMonth(month, 1)}-01`).start;

  const [schedules, exceptions, appointments, settings] = await Promise.all([
    listDoctorSchedules(doctorId, supabaseDoctorSchedulesRepository),
    listDoctorExceptions(
      { doctorId, start: monthStart, end: monthEnd },
      supabaseDoctorSchedulesRepository,
    ),
    listDoctorAppointmentsInRange(
      { doctorId, start: monthStart, end: monthEnd, status: null },
      supabaseDoctorAppointmentsRepository,
    ),
    getSettings(supabaseSettingsRepository),
  ]);

  const countByDate = new Map<
    string,
    Partial<Record<AppointmentStatus, number>>
  >();
  for (const appointment of appointments) {
    const date = manilaDateOfTimestamp(appointment.scheduledAt);
    const counts = countByDate.get(date) ?? {};
    counts[appointment.status] = (counts[appointment.status] ?? 0) + 1;
    countByDate.set(date, counts);
  }

  const today = todayInManila();
  const grid = buildMonthGrid({
    month,
    today,
    schedules,
    blocksByDate: summarizeBlocksByDate(exceptions),
    countByDate,
  });

  return (
    <ScheduleManager
      schedules={schedules}
      exceptions={exceptions}
      month={month}
      today={today}
      grid={grid}
      defaultSlotMinutes={settings["appointment.default_slot_minutes"]}
    />
  );
}

export default async function DoctorSchedulePage({
  searchParams,
}: {
  searchParams: Promise<DoctorSearchParams>;
}) {
  await connection();
  const params = await searchParams;

  // Each page guards itself; the layout's check only decides what it shows.
  const session = await getDoctorSession("/doctor/schedule");
  if (!session) {
    return <AccessDenied />;
  }
  const doctorId = session.doctor.id;

  return <CalendarWorkspace doctorId={doctorId} params={params} />;
}
