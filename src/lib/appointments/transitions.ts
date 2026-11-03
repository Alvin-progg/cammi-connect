import type { AppointmentStatus } from "./status";

/**
 * Every legal status change (SPEC-frontdesk §11, FD-001). The database
 * functions and guarded updates must agree with this table. `confirmed →
 * completed` is kept from ADR-0007 so a doctor can complete a visit that was
 * never checked in. A reschedule keeps the status and is not a transition.
 */
const STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = {
  requested: ["confirmed", "rejected", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show", "completed"],
  checked_in: ["completed"],
  rejected: [],
  cancelled: [],
  completed: [],
  no_show: [],
};

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function allowedTransitionsFrom(
  status: AppointmentStatus,
): readonly AppointmentStatus[] {
  return STATUS_TRANSITIONS[status];
}

/**
 * Doctor-initiated appointment actions and their legal source statuses.
 * Mirrors ADR-0007 (amended 2026-10-25). Terminal statuses allow no actions.
 * Confirmation is a front desk action only (ADR-0007 amendment 2026-11-03,
 * FD-001 PR 4), so doctors have no `confirm`.
 */
export const DOCTOR_APPOINTMENT_ACTIONS = [
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
  complete: ["confirmed"],
  no_show: ["confirmed"],
  cancel: ["requested", "confirmed"],
};

const ACTION_TARGETS: Record<DoctorAppointmentAction, AppointmentStatus> = {
  complete: "completed",
  no_show: "no_show",
  cancel: "cancelled",
};

export const DOCTOR_ACTION_LABELS: Record<DoctorAppointmentAction, string> = {
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

/**
 * Statuses a patient may cancel from (ADR-0007, AI-APT-001). Patient
 * cancellation windows are still deferred, so only the status is checked.
 */
export const PATIENT_CANCEL_SOURCES = [
  "requested",
  "confirmed",
] as const satisfies readonly AppointmentStatus[];

export function canPatientCancel(status: AppointmentStatus): boolean {
  return PATIENT_CANCEL_SOURCES.some((source) => source === status);
}
