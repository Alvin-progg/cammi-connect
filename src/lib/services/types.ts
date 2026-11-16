/**
 * How a patient reaches a hospital service. PAY-001 adds `scheduled` (time
 * slots from the service's own schedule, PAY-07); until then it only
 * documents access.
 */
export const SERVICE_BOOKING_MODES = ["none", "doctor_consultation", "walk_in", "scheduled"] as const;

export type ServiceBookingMode = (typeof SERVICE_BOOKING_MODES)[number];

export const SERVICE_BOOKING_MODE_LABELS: Record<ServiceBookingMode, string> = {
  none: "Informational only",
  doctor_consultation: "Doctor consultation",
  walk_in: "Walk-in",
  scheduled: "Scheduled (time slots)",
};

/** PAY-001 service categories; the services.category check in 0033 repeats them. */
export const SERVICE_CATEGORIES = [
  "laboratory",
  "imaging",
  "cardiac_diagnostics",
  "procedure",
  "package",
  "other",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  laboratory: "Laboratory",
  imaging: "Imaging",
  cardiac_diagnostics: "Cardiac diagnostics",
  procedure: "Procedure",
  package: "Package",
  other: "Other",
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
  category: ServiceCategory;
  /** Integer centavos; null is "price on request" (not bookable in chat). */
  priceCentavos: number | null;
  vatable: boolean;
  philhealthBenefitCentavos: number;
  hmoCoverable: boolean;
  requiresDoctorRequest: boolean;
  /** Walk-in patients per day; null is no cap. */
  dailyCapacity: number | null;
};
