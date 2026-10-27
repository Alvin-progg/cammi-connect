import type { AppointmentStatus } from "./status";

/**
 * Doctor-initiated appointment actions and their legal source statuses.
 * Mirrors ADR-0007 (amended 2026-10-25). Terminal statuses allow no actions.
 */
export const DOCTOR_APPOINTMENT_ACTIONS = [
  "confirm",
  "complete",
  "no_show",
  "cancel",
] as const;

export type DoctorAppointmentAction =
  (typeof DOCTOR_APPOINTMENT_ACTIONS)[number];

const ACTION_SOURCES: Record<
  DoctorAppointmentAction,
  readonly AppointmentStatus[]
> = {
  confirm: ["requested"],
  complete: ["confirmed"],
  no_show: ["confirmed"],
  cancel: ["requested", "confirmed"],
};

const ACTION_TARGETS: Record<DoctorAppointmentAction, AppointmentStatus> = {
  confirm: "confirmed",
  complete: "completed",
  no_show: "no_show",
  cancel: "cancelled",
};

export const DOCTOR_ACTION_LABELS: Record<DoctorAppointmentAction, string> = {
  confirm: "Confirm",
  complete: "Mark completed",
  no_show: "Mark no-show",
  cancel: "Cancel appointment",
};

export function canDoctorPerform(
  status: AppointmentStatus,
  action: DoctorAppointmentAction,
): boolean {
  return ACTION_SOURCES[action].includes(status);
}

export function sourceStatusesForAction(
  action: DoctorAppointmentAction,
): readonly AppointmentStatus[] {
  return ACTION_SOURCES[action];
}

export function targetStatusForAction(
  action: DoctorAppointmentAction,
): AppointmentStatus {
  return ACTION_TARGETS[action];
}

export function allowedDoctorActions(
  status: AppointmentStatus,
): DoctorAppointmentAction[] {
  return DOCTOR_APPOINTMENT_ACTIONS.filter((action) =>
    canDoctorPerform(status, action),
  );
}

export function isDoctorAppointmentAction(
  value: string,
): value is DoctorAppointmentAction {
  return DOCTOR_APPOINTMENT_ACTIONS.some((action) => action === value);
}
