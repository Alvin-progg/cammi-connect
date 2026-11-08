import type { Metadata } from "next";
import { connection } from "next/server";

import { AccessDenied } from "@/components/auth/access-denied";
import { DoctorProfileView } from "@/components/doctor/doctor-profile-view";
import { todayInManila } from "@/lib/appointments/filters";
import { getDoctorSession } from "@/server/auth/dal";
import {
  getDoctorProfileDetails,
  type DoctorProfileDetails,
} from "@/server/profiles/service";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import { listDoctorSchedules } from "@/server/schedules/service";

export const instant = false;

export const metadata: Metadata = { title: "Profile" };

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

export default async function DoctorProfilePage() {
  await connection();

  // Each page guards itself; the layout's check only decides what it shows.
  const session = await getDoctorSession("/doctor/profile");
  if (!session) {
    return <AccessDenied />;
  }
  const doctorId = session.doctor.id;
  const details = await getDoctorProfileDetails(doctorId);

  return <ProfileWorkspace details={details} doctorId={doctorId} />;
}
