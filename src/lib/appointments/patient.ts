import type { AppointmentStatus } from "./status";
import type { PatientAppointment } from "./types";

const ACTIVE_STATUSES: readonly AppointmentStatus[] = ["requested", "confirmed"];

export type PatientAppointmentGroups = {
  /** Requested or confirmed visits that have not started yet, soonest first. */
  upcoming: PatientAppointment[];
  /** Everything else, newest first. */
  past: PatientAppointment[];
};

export function splitPatientAppointments(
  appointments: PatientAppointment[],
  now: Date,
): PatientAppointmentGroups {
  const nowMs = now.getTime();
  const upcoming: PatientAppointment[] = [];
  const past: PatientAppointment[] = [];

  for (const appointment of appointments) {
    const isUpcoming =
      ACTIVE_STATUSES.includes(appointment.status) &&
      new Date(appointment.scheduledAt).getTime() >= nowMs;
    (isUpcoming ? upcoming : past).push(appointment);
  }

  const byTime = (a: PatientAppointment, b: PatientAppointment) =>
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  upcoming.sort(byTime);
  past.sort((a, b) => byTime(b, a));
  return { upcoming, past };
}
