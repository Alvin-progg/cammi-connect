import type { AppointmentStatus } from "@/lib/appointments/status";
import type { DoctorSummary } from "@/lib/directory/types";

export type DoctorStatusFilter = "all" | "active" | "inactive";

export type DoctorTab = "profile" | "schedule" | "appointments";

/** One row of the admin doctors list. */
export type AdminDoctorListItem = DoctorSummary & {
  /** True when the doctor's profile has a sign-in account. */
  hasLogin: boolean;
};

/**
 * Admin-only view of a doctor. The contact fields never leave the admin pages:
 * patient booking and Cami read `DoctorSummary`, which has none of them.
 */
export type AdminDoctorDetail = AdminDoctorListItem & {
  contactEmail: string | null;
  contactPhone: string | null;
  bio: string | null;
};

/** A `doctor` account with a login and no doctor record yet. */
export type LinkableDoctorAccount = { profileId: string; fullName: string };

/** A future appointment that blocks deactivating a doctor. No patient data. */
export type DoctorConflict = {
  appointmentId: string;
  scheduledAt: string;
  status: AppointmentStatus;
};

/** One row of a doctor's appointment history on the admin page. No patient data. */
export type DoctorAppointmentRow = {
  appointmentId: string;
  scheduledAt: string;
  status: AppointmentStatus;
  specialtyName: string | null;
};
