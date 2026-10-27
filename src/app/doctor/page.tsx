import type { Metadata } from "next";

import { AppointmentTable } from "@/components/appointments/appointment-table";
import { AccessDenied } from "@/components/auth/access-denied";
import { AppointmentBoard } from "@/components/doctor/appointment-board";
import { DoctorHeader } from "@/components/doctor/doctor-header";
import { DoctorProfileView } from "@/components/doctor/doctor-profile-view";
import { DoctorShell } from "@/components/doctor/doctor-shell";
import { DoctorStatsPanel } from "@/components/doctor/doctor-stats-panel";
import { NotificationsPanel } from "@/components/doctor/notifications-panel";
import { ScheduleManager } from "@/components/doctor/schedule-manager";
import {
  parseAppointmentRange,
  parseAppointmentStatusFilter,
  parseCalendarMonth,
  parseDashboardView,
  parseStatsPeriod,
  resolveRangeBounds,
  resolveStatsPeriodBounds,
  shiftCalendarMonth,
  type DoctorView,
} from "@/lib/appointments/dashboard";
import { formatManilaDate } from "@/lib/appointments/format";
import {
  manilaDayRange,
  todayInManila,
} from "@/lib/appointments/filters";
import { manilaDateOfTimestamp } from "@/lib/appointments/stats";
import type { AppointmentStatus } from "@/lib/appointments/status";
import type { BlockedSlot } from "@/lib/schedules/types";
import { formatScheduleSummary } from "@/lib/schedules/types";
import { buildMonthGrid } from "@/lib/schedules/calendar";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import {
  countDoctorAppointments,
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
  listDepartmentColleagues,
  type DepartmentColleague,
  type DoctorProfileDetails,
} from "@/server/profiles/service";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import {
  listDoctorBlockedSlots,
  listDoctorSchedules,
} from "@/server/schedules/service";

export const instant = false;

export const metadata: Metadata = { title: "Doctor dashboard" };

type DoctorSearchParams = {
  view?: string | string[];
  range?: string | string[];
  date?: string | string[];
  status?: string | string[];
  month?: string | string[];
  period?: string | string[];
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

/** Every Manila calendar date touched by a block, for calendar markers. */
function expandBlocksToDates(blocks: BlockedSlot[]): string[] {
  const dates = new Set<string>();
  for (const block of blocks) {
    const startDay = manilaDayRange(
      manilaDateOfTimestamp(block.startsAt),
    ).start;
    const lastCoveredDay = manilaDayRange(
      manilaDateOfTimestamp(
        new Date(new Date(block.endsAt).getTime() - 1).toISOString(),
      ),
    ).start;
    for (
      let day = startDay.getTime(), guard = 0;
      day <= lastCoveredDay.getTime() && guard < 40;
      day += DAY_IN_MILLISECONDS, guard += 1
    ) {
      dates.add(manilaDateOfTimestamp(new Date(day).toISOString()));
    }
  }
  return [...dates];
}

async function AppointmentsWorkspace({
  doctorId,
  view,
  params,
}: {
  doctorId: string;
  view: DoctorView;
  params: DoctorSearchParams;
}) {
  const { range, date } = parseAppointmentRange(params);
  const status = parseAppointmentStatusFilter(params.status);
  const bounds = resolveRangeBounds({ range, date });

  const [appointments, schedules] = await Promise.all([
    listDoctorAppointmentsInRange(
      { doctorId, start: bounds.start, end: bounds.end, status },
      supabaseDoctorAppointmentsRepository,
    ),
    listDoctorSchedules(doctorId, supabaseDoctorSchedulesRepository),
  ]);
  const historyMap = await getAppointmentHistoryMap(
    { appointmentIds: appointments.map((appointment) => appointment.id) },
    supabaseDoctorAppointmentsRepository,
  );
  const scheduleHint = formatScheduleSummary(schedules);

  return (
    <>
      <p className="mb-4 text-sm text-ink-muted" role="status">
        {appointments.length === 0
          ? `No appointments · ${bounds.description}`
          : `${appointments.length} appointment${appointments.length === 1 ? "" : "s"} · ${bounds.description}`}
      </p>
      {view === "board" ? (
        <AppointmentBoard
          appointments={appointments}
          historyMap={historyMap}
          scheduleHint={scheduleHint}
        />
      ) : (
        <section
          aria-labelledby="appointments-heading"
          className="overflow-hidden rounded-xl border border-line bg-surface"
        >
          <div className="border-b border-line px-4 py-3 sm:px-6">
            <h2
              id="appointments-heading"
              className="text-lg font-semibold text-ink"
            >
              Appointments
            </h2>
          </div>
          <AppointmentTable
            appointments={appointments}
            historyMap={historyMap}
            scheduleHint={scheduleHint}
          />
        </section>
      )}
    </>
  );
}

async function CalendarWorkspace({ doctorId, params }: { doctorId: string; params: DoctorSearchParams }) {
  const month = parseCalendarMonth(params.month);
  const monthStart = manilaDayRange(`${month}-01`).start;
  const monthEnd = manilaDayRange(`${shiftCalendarMonth(month, 1)}-01`).start;

  const [schedules, blocks, appointments] = await Promise.all([
    listDoctorSchedules(doctorId, supabaseDoctorSchedulesRepository),
    listDoctorBlockedSlots(
      { doctorId, start: monthStart, end: monthEnd },
      supabaseDoctorSchedulesRepository,
    ),
    listDoctorAppointmentsInRange(
      { doctorId, start: monthStart, end: monthEnd, status: null },
      supabaseDoctorAppointmentsRepository,
    ),
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

  const grid = buildMonthGrid({
    month,
    today: todayInManila(),
    schedules,
    blockedDates: expandBlocksToDates(blocks),
    countByDate,
  });

  return (
    <ScheduleManager
      schedules={schedules}
      blocks={blocks}
      month={month}
      grid={grid}
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

async function NotificationsWorkspace({ doctorId }: { doctorId: string }) {
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
  return <DoctorProfileView details={details} schedules={schedules} />;
}

export default async function DoctorPage({
  searchParams,
}: {
  searchParams: Promise<DoctorSearchParams>;
}) {
  const params = await searchParams;
  const session = await getDoctorSession("/doctor");

  if (!session) {
    return <AccessDenied />;
  }

  const doctorId = session.doctor.id;
  const view = parseDashboardView(params.view);
  const todayRange = manilaDayRange(todayInManila());

  const details = await getDoctorProfileDetails(doctorId);
  const [colleagues, todayCount, unreadCount]: [
    DepartmentColleague[],
    number,
    number,
  ] = await Promise.all([
    details?.department
      ? listDepartmentColleagues({
          departmentId: details.department.id,
          excludeProfileId: doctorId,
        })
      : Promise.resolve([]),
    countDoctorAppointments(
      { doctorId, start: todayRange.start, end: todayRange.end },
      supabaseDoctorAppointmentsRepository,
    ),
    countUnreadDoctorNotifications(
      doctorId,
      supabaseDoctorNotificationsRepository,
    ),
  ]);

  const { range, date } = parseAppointmentRange(params);
  const status = parseAppointmentStatusFilter(params.status);

  return (
    <DoctorShell
      activeView={view}
      doctorName={session.doctor.fullName}
      specialty={details?.specialty ?? null}
      departmentName={details?.department?.name ?? null}
      colleagues={colleagues}
      todayCount={todayCount}
      unreadCount={unreadCount}
    >
      <DoctorHeader
        view={view}
        doctorName={session.doctor.fullName}
        departmentName={details?.department?.name ?? null}
        todayLabel={formatManilaDate(todayInManila())}
        range={range}
        status={status}
        date={date}
      />
      <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
        {view === "board" || view === "list" ? (
          <AppointmentsWorkspace doctorId={doctorId} view={view} params={params} />
        ) : null}
        {view === "calendar" ? (
          <CalendarWorkspace doctorId={doctorId} params={params} />
        ) : null}
        {view === "stats" ? (
          <StatsWorkspace doctorId={doctorId} params={params} />
        ) : null}
        {view === "notifications" ? (
          <NotificationsWorkspace doctorId={doctorId} />
        ) : null}
        {view === "profile" ? (
          <ProfileWorkspace details={details} doctorId={doctorId} />
        ) : null}
      </div>
    </DoctorShell>
  );
}
