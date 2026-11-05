/**
 * How a patient reaches a hospital service. It only documents access: services
 * have no scheduling or capacity of their own (decision D9).
 */
export const SERVICE_BOOKING_MODES = ["none", "doctor_consultation", "walk_in"] as const;

export type ServiceBookingMode = (typeof SERVICE_BOOKING_MODES)[number];

export const SERVICE_BOOKING_MODE_LABELS: Record<ServiceBookingMode, string> = {
  none: "Informational only",
  doctor_consultation: "Doctor consultation",
  walk_in: "Walk-in",
};

export type ServiceStatusFilter = "all" | "active" | "inactive";

/** A hospital service as the admin pages show it. No patient data. */
export type HospitalService = {
  id: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  departmentName: string | null;
  requiresAppointment: boolean;
  bookingMode: ServiceBookingMode;
  isActive: boolean;
};
