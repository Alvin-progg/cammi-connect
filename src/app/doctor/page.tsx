import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AccessDenied } from "@/components/auth/access-denied";
import { AppointmentsCard } from "@/components/doctor/appointments-card";
import { DoctorHeader } from "@/components/doctor/doctor-header";
import { DoctorProfileView } from "@/components/doctor/doctor-profile-view";
import { DoctorShell } from "@/components/doctor/doctor-shell";
import { DoctorStatsPanel } from "@/components/doctor/doctor-stats-panel";
import { NotificationsPanel } from "@/components/doctor/notifications-panel";
import { toHistoryItems } from "@/components/doctor/history-items";
import { ScheduleManager } from "@/components/doctor/schedule-manager";
import { WeekSchedule } from "@/components/doctor/week-schedule";
import { CardSkeleton, DashboardPageSkeleton, DetailPageSkeleton } from "@/components/ui/skeleton";
import {
  DOCTOR_VIEW_LABELS,
  parseAppointmentStatusFilter,
  parseCalendarMonth,
  parseDashboardView,
  parseStatsPeriod,
  parseWeekStart,
  resolveStatsPeriodBounds,
  shiftCalendarMonth,
  shiftWeek,
  type DoctorView,
} from "@/lib/appointments/dashboard";
import { formatManilaDate } from "@/lib/appointments/format";
import {
  manilaDayRange,
  todayInManila,
} from "@/lib/appointments/filters";
import { manilaDateOfTimestamp } from "@/lib/appointments/stats";
import type { AppointmentStatus } from "@/lib/appointments/status";
import { buildWeekLayout } from "@/lib/appointments/week";
import { formatScheduleSummary } from "@/lib/schedules/types";
import { buildMonthGrid, summarizeBlocksByDate } from "@/lib/schedules/calendar";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import {
  getAppointmentHistoryMap,
  getDoctorAppointmentStats,
  listDoctorAppointmentsInRange,
} from "@/server/appointments/service";
import { getDoctorSession } from "@/server/auth/dal";
import { supabaseDoctorNotificationsRepository } from "@/server/notifications/repository";
import {
  countUnreadDoctorNotifications,
  listDoctorNotifications,
  listUpcomingReminders,
} from "@/server/notifications/service";
import {
  getDoctorProfileDetails,
  type DoctorProfileDetails,
} from "@/server/profiles/service";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import {
  listDoctorExceptions,
  listDoctorSchedules,
} from "@/server/schedules/service";
import { supabaseSettingsRepository } from "@/server/settings/repository";
import { getSettings } from "@/server/settings/service";

export const instant = false;

export const metadata: Metadata = { title: "Doctor dashboard" };

type DoctorSearchParams = {
  view?: string | string[];
  status?: string | string[];
  month?: string | string[];
  period?: string | string[];
  week?: string | string[];
};

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

async function StatsWorkspace({
  doctorId,
  params,
}: {
  doctorId: string;
  params: DoctorSearchParams;
}) {
  const period = parseStatsPeriod(params.period);
  const bounds = resolveStatsPeriodBounds(period);
  const stats = await getDoctorAppointmentStats(
    { doctorId, start: bounds.start, end: bounds.end },
    supabaseDoctorAppointmentsRepository,
  );
  return <DoctorStatsPanel stats={stats} period={period} />;
}

async function NotificationsModalPanel({ doctorId }: { doctorId: string }) {
  const [notifications, reminders] = await Promise.all([
    listDoctorNotifications(doctorId, supabaseDoctorNotificationsRepository),
    listUpcomingReminders({ doctorId }, supabaseDoctorAppointmentsRepository),
  ]);
  return (
    <NotificationsPanel notifications={notifications} reminders={reminders} />
  );
}

async function ProfileWorkspace({
  details,
  doctorId,
}: {
  details: DoctorProfileDetails | null;
  doctorId: string;
}) {
  const schedules = await listDoctorSchedules(
    doctorId,
    supabaseDoctorSchedulesRepository,
  );
  if (!details) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-sm text-ink-muted">
        Your doctor profile could not be found. Contact the hospital
        administration.
      </p>
    );
  }
  return (
    <DoctorProfileView
      details={details}
      schedules={schedules}
      today={todayInManila()}
    />
  );
}

function ViewSkeleton({ view }: { view: DoctorView }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        Loading…
      </p>
      {view === "stats" ? <DashboardPageSkeleton /> : null}
      {view === "profile" ? <DetailPageSkeleton /> : null}
      {view === "week" || view === "calendar" ? <CardSkeleton lines={12} className="min-h-[32rem]" /> : null}
    </div>
  );
}

export default async function DoctorPage({
  searchParams,
}: {
  searchParams: Promise<DoctorSearchParams>;
}) {
  await connection();
  const params = await searchParams;
  const session = await getDoctorSession("/doctor");

  if (!session) {
    return <AccessDenied />;
  }

  const doctorId = session.doctor.id;
  const view = parseDashboardView(params.view);

  const [details, unreadCount] = await Promise.all([
    getDoctorProfileDetails(doctorId),
    countUnreadDoctorNotifications(
      doctorId,
      supabaseDoctorNotificationsRepository,
    ),
  ]);

  return (
    <DoctorShell
      activeView={view}
      doctorName={session.doctor.fullName}
      specialty={details?.specialty ?? null}
      unreadCount={unreadCount}
      notificationsPanel={<NotificationsModalPanel doctorId={doctorId} />}
    >
      <DoctorHeader
        title={view === "week" ? "Appointments" : DOCTOR_VIEW_LABELS[view]}
        todayLabel={formatManilaDate(todayInManila())}
        unreadCount={unreadCount}
        doctorName={session.doctor.fullName}
        specialty={details?.specialty ?? null}
      />
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
        {/* Keyed by view: switching views only changes ?view=, which does not
            show loading.tsx, so each view gets its own skeleton. */}
        <Suspense key={view} fallback={<ViewSkeleton view={view} />}>
          {view === "week" ? (
            <AppointmentsWorkspace doctorId={doctorId} params={params} />
          ) : null}
          {view === "calendar" ? (
            <CalendarWorkspace doctorId={doctorId} params={params} />
          ) : null}
          {view === "stats" ? (
            <StatsWorkspace doctorId={doctorId} params={params} />
          ) : null}
          {view === "profile" ? (
            <ProfileWorkspace details={details} doctorId={doctorId} />
          ) : null}
        </Suspense>
      </div>
    </DoctorShell>
  );
}
