export const APPOINTMENT_STATUSES = [
  "requested",
  "confirmed",
  "rejected",
  "cancelled",
  "checked_in",
  "completed",
  "no_show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/**
 * `requested` is the stored value for what SPEC-frontdesk calls
 * `pending_confirmation`; only the label uses the spec's wording (FD-001).
 */
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: "Pending confirmation",
  confirmed: "Confirmed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  checked_in: "Checked in",
  completed: "Completed",
  no_show: "No-show",
};

export function isAppointmentStatus(
  value: string,
): value is AppointmentStatus {
  return APPOINTMENT_STATUSES.some((status) => status === value);
}

/**
 * Statuses that occupy a doctor's time slot. Mirrors the predicate of the
 * `appointments_no_active_overlap` exclusion constraint (migration 0007).
 */
export const SLOT_HOLDING_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
] as const satisfies readonly AppointmentStatus[];

/** Where an appointment came from (SPEC-frontdesk §10, `appointments.booking_source`). */
export const BOOKING_SOURCES = ["ai_chatbot", "front_desk", "other"] as const;

export type BookingSource = (typeof BOOKING_SOURCES)[number];

export function isBookingSource(value: string): value is BookingSource {
  return BOOKING_SOURCES.some((source) => source === value);
}
