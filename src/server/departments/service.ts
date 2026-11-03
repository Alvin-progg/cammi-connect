import "server-only";

import {
  DEPARTMENT_REFUSAL_MESSAGES,
  departmentRefusalFromCode,
} from "@/lib/departments/refusals";
import type { DepartmentFormInput } from "@/lib/departments/schemas";
import { countsByStatus, totalsByDepartment } from "@/lib/departments/stats";
import {
  DEPARTMENT_STATS_WINDOW_DAYS,
  type DepartmentConflict,
  type DepartmentOverview,
  type DepartmentStatRow,
  type DepartmentStatusCounts,
} from "@/lib/departments/types";
import type { Department, DoctorSummary } from "@/lib/directory/types";

type DatabaseOutcome = { ok: true } | { ok: false; code: string | undefined };

/**
 * Data access for admin department management. Callers authorize first, and
 * `actorId` must come from the admin session.
 */
export type DepartmentAdminStore = {
  listDepartments(): Promise<Department[]>;
  countDoctorsByDepartment(): Promise<Map<string, number>>;
  listAppointmentStats(range: { from: Date; to: Date }): Promise<DepartmentStatRow[]>;
  getDepartment(departmentId: string): Promise<Department | null>;
  /** Every doctor assigned to the department, active or not. */
  listDoctors(departmentId: string): Promise<DoctorSummary[]>;
  listFutureConflicts(departmentId: string): Promise<DepartmentConflict[]>;
  save(input: {
    actorId: string;
    departmentId: string | null;
    name: string;
    code: string;
    description: string | null;
  }): Promise<{ ok: true; departmentId: string } | { ok: false; code: string | undefined }>;
  setActive(input: {
    actorId: string;
    departmentId: string;
    isActive: boolean;
  }): Promise<DatabaseOutcome>;
};

export type DepartmentActiveResult =
  | { ok: true; message: string }
  | { ok: false; message: string; conflicts?: DepartmentConflict[] };

const GENERIC_FAILURE = "Something went wrong. Try again.";
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function refusalMessage(code: string | undefined): string {
  const refusal = departmentRefusalFromCode(code);
  return refusal ? DEPARTMENT_REFUSAL_MESSAGES[refusal] : GENERIC_FAILURE;
}

function statsWindow(now: Date): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - DEPARTMENT_STATS_WINDOW_DAYS * DAY_IN_MILLISECONDS),
    to: now,
  };
}

export async function listDepartmentsOverview(
  store: DepartmentAdminStore,
  now: Date = new Date(),
): Promise<DepartmentOverview[]> {
  const [departments, doctorCounts, stats] = await Promise.all([
    store.listDepartments(),
    store.countDoctorsByDepartment(),
    store.listAppointmentStats(statsWindow(now)),
  ]);
  const appointmentTotals = totalsByDepartment(stats);

  return departments.map((department) => ({
    ...department,
    doctorCount: doctorCounts.get(department.id) ?? 0,
    recentAppointmentCount: appointmentTotals.get(department.id) ?? 0,
  }));
}

export async function getDepartmentDetail(
  departmentId: string,
  store: DepartmentAdminStore,
  now: Date = new Date(),
): Promise<{
  department: Department;
  doctors: DoctorSummary[];
  statusCounts: DepartmentStatusCounts;
} | null> {
  const department = await store.getDepartment(departmentId);
  if (!department) {
    return null;
  }
  const [doctors, stats] = await Promise.all([
    store.listDoctors(departmentId),
    store.listAppointmentStats(statsWindow(now)),
  ]);
  return { department, doctors, statusCounts: countsByStatus(stats, departmentId) };
}

export async function saveDepartment(
  {
    actorId,
    departmentId,
    input,
  }: { actorId: string; departmentId: string | null; input: DepartmentFormInput },
  store: DepartmentAdminStore,
): Promise<{ ok: true; departmentId: string; message: string } | { ok: false; message: string }> {
  const saved = await store.save({ actorId, departmentId, ...input });
  if (!saved.ok) {
    return { ok: false, message: refusalMessage(saved.code) };
  }
  return { ok: true, departmentId: saved.departmentId, message: "Department saved." };
}

/**
 * Activates or deactivates a department. Deactivation is refused while any of
 * its doctors has a future requested or confirmed appointment (D6); the
 * blocking appointments are returned so the admin can pass them to the front
 * desk. The database function re-checks inside its transaction.
 */
export async function setDepartmentActive(
  input: { actorId: string; departmentId: string; isActive: boolean },
  store: DepartmentAdminStore,
): Promise<DepartmentActiveResult> {
  const blocked = (conflicts: DepartmentConflict[]): DepartmentActiveResult => ({
    ok: false,
    message: DEPARTMENT_REFUSAL_MESSAGES.has_future_appointments,
    conflicts,
  });

  if (!input.isActive) {
    const conflicts = await store.listFutureConflicts(input.departmentId);
    if (conflicts.length > 0) {
      return blocked(conflicts);
    }
  }

  const outcome = await store.setActive(input);
  if (outcome.ok) {
    return {
      ok: true,
      message: input.isActive ? "Department activated." : "Department deactivated.",
    };
  }
  if (outcome.code === "has_future_appointments") {
    return blocked(await store.listFutureConflicts(input.departmentId));
  }
  return { ok: false, message: refusalMessage(outcome.code) };
}
