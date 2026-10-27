export const NOTIFICATION_TYPES = [
  "new_request",
  "cancelled",
  "rescheduled",
  "reminder",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_request: "New request",
  cancelled: "Cancellation",
  rescheduled: "Reschedule",
  reminder: "Reminder",
};

export type DoctorNotification = {
  id: string;
  appointmentId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/** Computed (not persisted) reminder for an upcoming confirmed consultation. */
export type AppointmentReminder = {
  appointmentId: string;
  patientName: string;
  scheduledAt: string;
};
