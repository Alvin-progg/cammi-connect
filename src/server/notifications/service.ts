import "server-only";

import type {
  AppointmentReminder,
  DoctorNotification,
} from "@/lib/notifications/types";

export type DoctorNotificationsReader = {
  listForDoctor(input: {
    doctorId: string;
    limit: number;
  }): Promise<DoctorNotification[]>;
  countUnreadForDoctor(doctorId: string): Promise<number>;
  markRead(input: {
    doctorId: string;
    notificationId: string;
  }): Promise<boolean>;
  markAllRead(doctorId: string): Promise<void>;
};

/** Minimal appointment read needed for computed upcoming reminders. */
export type ReminderAppointmentsReader = {
  listForDoctor(input: {
    doctorId: string;
    start: string;
    end: string;
    status: "confirmed";
  }): Promise<
    { id: string; patientName: string; scheduledAt: string }[]
  >;
};

export async function listDoctorNotifications(
  doctorId: string,
  reader: DoctorNotificationsReader,
): Promise<DoctorNotification[]> {
  return reader.listForDoctor({ doctorId, limit: 50 });
}

export async function countUnreadDoctorNotifications(
  doctorId: string,
  reader: DoctorNotificationsReader,
): Promise<number> {
  return reader.countUnreadForDoctor(doctorId);
}

export async function markNotificationRead(
  input: { doctorId: string; notificationId: string },
  reader: DoctorNotificationsReader,
): Promise<boolean> {
  return reader.markRead(input);
}

export async function markAllNotificationsRead(
  doctorId: string,
  reader: DoctorNotificationsReader,
): Promise<void> {
  return reader.markAllRead(doctorId);
}

const REMINDER_WINDOW_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Reminders are computed from authoritative confirmed appointments in the
 * next 24 hours — they are never persisted, so they can never go stale.
 */
export async function listUpcomingReminders(
  input: { doctorId: string; now?: Date },
  reader: ReminderAppointmentsReader,
): Promise<AppointmentReminder[]> {
  const now = input.now ?? new Date();
  const appointments = await reader.listForDoctor({
    doctorId: input.doctorId,
    start: now.toISOString(),
    end: new Date(now.getTime() + REMINDER_WINDOW_MILLISECONDS).toISOString(),
    status: "confirmed",
  });
  return appointments.map((appointment) => ({
    appointmentId: appointment.id,
    patientName: appointment.patientName,
    scheduledAt: appointment.scheduledAt,
  }));
}
