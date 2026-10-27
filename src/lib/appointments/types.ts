import type { AppointmentStatus } from "./status";

/**
 * The only appointment fields the doctor dashboard is allowed to display.
 * Patient identifiers, contact details, and clinical records stay out of this
 * DTO on purpose.
 */
export type DoctorAppointment = {
  id: string;
  patientName: string;
  reason: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
};

/**
 * A single audit entry for an appointment. Written on every status transition
 * and reschedule (ADR-0007, amended 2026-10-25).
 */
export type AppointmentHistoryEntry = {
  id: string;
  appointmentId: string;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  reason: string | null;
  scheduledAtSnapshot: string | null;
  createdAt: string;
};
