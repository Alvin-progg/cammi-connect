import type { Metadata } from "next";
import { connection } from "next/server";

import { AccessDenied } from "@/components/auth/access-denied";
import { DoctorStatsPanel } from "@/components/doctor/doctor-stats-panel";
import { parseStatsPeriod, resolveStatsPeriodBounds } from "@/lib/appointments/dashboard";
import { supabaseDoctorAppointmentsRepository } from "@/server/appointments/repository";
import { getDoctorAppointmentStats } from "@/server/appointments/service";
import { getDoctorSession } from "@/server/auth/dal";

export const instant = false;

export const metadata: Metadata = { title: "Statistics" };

type DoctorSearchParams = Record<string, string | string[] | undefined>;

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

export default async function DoctorStatsPage({
  searchParams,
}: {
  searchParams: Promise<DoctorSearchParams>;
}) {
  await connection();
  const params = await searchParams;

  // Each page guards itself; the layout's check only decides what it shows.
  const session = await getDoctorSession("/doctor/stats");
  if (!session) {
    return <AccessDenied />;
  }
  const doctorId = session.doctor.id;

  return <StatsWorkspace doctorId={doctorId} params={params} />;
}
