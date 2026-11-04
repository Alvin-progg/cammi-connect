import "server-only";

import { DOCTOR_REFUSAL_MESSAGES, doctorRefusalFromCode } from "@/lib/doctors/refusals";
import type { DoctorFormInput } from "@/lib/doctors/schemas";
import type {
  AdminDoctorDetail,
  AdminDoctorListItem,
  DoctorAppointmentRow,
  DoctorConflict,
  DoctorStatusFilter,
  LinkableDoctorAccount,
} from "@/lib/doctors/types";

type DatabaseOutcome = { ok: true } | { ok: false; code: string | undefined };

export type AdminDoctorFilter = {
  departmentId?: string;
  specialtyId?: string;
  status: DoctorStatusFilter;
};

/**
 * Data access for admin doctor management. Callers authorize first, and
 * `actorId` must come from the admin session.
 */
export type DoctorAdminStore = {
  listDoctors(filter: AdminDoctorFilter): Promise<AdminDoctorListItem[]>;
  getDoctor(doctorId: string): Promise<AdminDoctorDetail | null>;
  listLinkableAccounts(): Promise<LinkableDoctorAccount[]>;
  /** True when this one profile is an active doctor account with a login and no doctor record. */
  isLinkableAccount(profileId: string): Promise<boolean>;
  listFutureConflicts(doctorId: string): Promise<DoctorConflict[]>;
  listAppointmentHistory(doctorId: string): Promise<DoctorAppointmentRow[]>;
  /** Saves the doctor and replaces its specialty set in one transaction. */
  save(
    input: { actorId: string; doctorId: string | null } & DoctorFormInput,
  ): Promise<{ ok: true; doctorId: string } | { ok: false; code: string | undefined }>;
  linkAccount(input: {
    actorId: string;
    doctorId: string;
    accountProfileId: string;
  }): Promise<DatabaseOutcome>;
  setActive(input: { actorId: string; doctorId: string; isActive: boolean }): Promise<DatabaseOutcome>;
};

export type DoctorActiveResult =
  | { ok: true; message: string }
  | { ok: false; message: string; conflicts?: DoctorConflict[] };

const GENERIC_FAILURE = "Something went wrong. Try again.";

function refusalMessage(code: string | undefined): string {
  const refusal = doctorRefusalFromCode(code);
  return refusal ? DOCTOR_REFUSAL_MESSAGES[refusal] : GENERIC_FAILURE;
}

/**
 * Creates or updates a doctor with its specialty set. A linked account is only
 * taken on create; an existing doctor is linked through `linkDoctorAccount`.
 */
export async function saveDoctor(
  {
    actorId,
    doctorId,
    input,
  }: { actorId: string; doctorId: string | null; input: DoctorFormInput },
  store: DoctorAdminStore,
): Promise<{ ok: true; doctorId: string; message: string } | { ok: false; message: string }> {
  const accountProfileId = doctorId === null ? input.accountProfileId : null;
  // Only an unlinked `doctor` account may be linked (spec: checked here and
  // again by the database).
  if (accountProfileId && !(await store.isLinkableAccount(accountProfileId))) {
    return { ok: false, message: DOCTOR_REFUSAL_MESSAGES.not_linkable };
  }

  const saved = await store.save({ actorId, doctorId, ...input, accountProfileId });
  if (!saved.ok) {
    return { ok: false, message: refusalMessage(saved.code) };
  }
  return { ok: true, doctorId: saved.doctorId, message: "Doctor saved." };
}

/** Gives an existing doctor without a login the sign-in of an unlinked doctor account. */
export async function linkDoctorAccount(
  input: { actorId: string; doctorId: string; accountProfileId: string },
  store: DoctorAdminStore,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!(await store.isLinkableAccount(input.accountProfileId))) {
    return { ok: false, message: DOCTOR_REFUSAL_MESSAGES.not_linkable };
  }
  const outcome = await store.linkAccount(input);
  if (!outcome.ok) {
    return { ok: false, message: refusalMessage(outcome.code) };
  }
  return { ok: true, message: "Account linked." };
}

/**
 * Activates or deactivates a doctor. Deactivation is refused while the doctor
 * has a future requested or confirmed appointment (D6); the blocking
 * appointments are returned so the admin can pass them to the front desk. The
 * database function re-checks inside its transaction.
 */
export async function setDoctorActive(
  input: { actorId: string; doctorId: string; isActive: boolean },
  store: DoctorAdminStore,
): Promise<DoctorActiveResult> {
  const blocked = (conflicts: DoctorConflict[]): DoctorActiveResult => ({
    ok: false,
    message: DOCTOR_REFUSAL_MESSAGES.has_future_appointments,
    conflicts,
  });

  if (!input.isActive) {
    const conflicts = await store.listFutureConflicts(input.doctorId);
    if (conflicts.length > 0) {
      return blocked(conflicts);
    }
  }

  const outcome = await store.setActive(input);
  if (outcome.ok) {
    return { ok: true, message: input.isActive ? "Doctor activated." : "Doctor deactivated." };
  }
  if (outcome.code === "has_future_appointments") {
    return blocked(await store.listFutureConflicts(input.doctorId));
  }
  return { ok: false, message: refusalMessage(outcome.code) };
}
