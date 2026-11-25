export const NOTIFICATION_TYPES = [
  "new_request",
  "confirmed",
  "cancelled",
  "rescheduled",
  "reminder",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_request: "New request",
  confirmed: "Confirmed",
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

export const PATIENT_NOTIFICATION_TYPES = [
  "confirmed",
  "rejected",
  "cancelled",
  "rescheduled",
  "payment_verified",
  "payment_rejected",
  "hmo_approved",
  "hmo_denied",
  "payment_expired",
  "pwd_verified",
  "pwd_rejected",
  "hmo_membership_verified",
  "hmo_membership_rejected",
] as const;

export type PatientNotificationType = (typeof PATIENT_NOTIFICATION_TYPES)[number];

export const PATIENT_NOTIFICATION_TYPE_LABELS: Record<PatientNotificationType, string> = {
  confirmed: "Confirmed",
  rejected: "Not approved",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  payment_verified: "Payment",
  payment_rejected: "Receipt",
  hmo_approved: "HMO",
  hmo_denied: "HMO",
  payment_expired: "Payment",
  pwd_verified: "PWD",
  pwd_rejected: "PWD",
  hmo_membership_verified: "HMO",
  hmo_membership_rejected: "HMO",
};

export type PatientNotification = {
  id: string;
  appointmentId: string | null;
  type: PatientNotificationType;
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
