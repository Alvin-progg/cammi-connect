import "server-only";

import type { PatientNotification } from "@/lib/notifications/types";

export type PatientNotificationsReader = {
  listForPatient(input: {
    patientId: string;
    limit: number;
  }): Promise<PatientNotification[]>;
  countUnreadForPatient(patientId: string): Promise<number>;
  markRead(input: {
    patientId: string;
    notificationId: string;
  }): Promise<boolean>;
  markAllRead(patientId: string): Promise<void>;
};

export async function listPatientNotifications(
  patientId: string,
  reader: PatientNotificationsReader,
): Promise<PatientNotification[]> {
  return reader.listForPatient({ patientId, limit: 50 });
}

export async function countUnreadPatientNotifications(
  patientId: string,
  reader: PatientNotificationsReader,
): Promise<number> {
  return reader.countUnreadForPatient(patientId);
}

export async function markPatientNotificationRead(
  input: { patientId: string; notificationId: string },
  reader: PatientNotificationsReader,
): Promise<boolean> {
  return reader.markRead(input);
}

export async function markAllPatientNotificationsRead(
  patientId: string,
  reader: PatientNotificationsReader,
): Promise<void> {
  return reader.markAllRead(patientId);
}
