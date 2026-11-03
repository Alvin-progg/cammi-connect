import type { AppointmentStatus } from "@/lib/appointments/status";
import type { Department } from "@/lib/directory/types";

/** Appointment stats on the department pages cover this many past days. */
export const DEPARTMENT_STATS_WINDOW_DAYS = 30;

export type DepartmentOverview = Department & {
  doctorCount: number;
  /** Appointments scheduled in the stats window, any status. */
  recentAppointmentCount: number;
};

/** One row of cammi_connect_department_appointment_stats. */
export type DepartmentStatRow = {
  departmentId: string;
  status: AppointmentStatus;
  count: number;
};

export type DepartmentStatusCounts = Partial<Record<AppointmentStatus, number>>;

/** A future appointment that blocks deactivating its department. No patient data. */
export type DepartmentConflict = {
  appointmentId: string;
  scheduledAt: string;
  status: AppointmentStatus;
  doctorName: string;
};
