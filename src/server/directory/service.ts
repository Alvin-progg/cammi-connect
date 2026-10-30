import "server-only";

import type {
  DepartmentInput,
  DoctorInput,
  SpecialtyInput,
} from "@/lib/directory/schemas";
import type {
  Department,
  DoctorSummary,
  LinkableAccount,
  Specialty,
} from "@/lib/directory/types";

/** "duplicate" covers a unique name/code clash; "not_found" an update to a missing id. */
export type SaveOutcome = "saved" | "duplicate" | "not_found";

export type DoctorFilter = {
  departmentId?: string;
  specialtyId?: string;
  activeOnly: boolean;
};

/**
 * Data access contract for departments, specialties, and doctors. Callers
 * authorize first: writes are admin-only, reads are open to signed-in users.
 */
export type DirectoryStore = {
  listDepartments(): Promise<Department[]>;
  saveDepartment(input: { id: string | null } & DepartmentInput): Promise<SaveOutcome>;
  listSpecialties(): Promise<Specialty[]>;
  saveSpecialty(input: { id: string | null } & SpecialtyInput): Promise<SaveOutcome>;
  listDoctors(filter: DoctorFilter): Promise<DoctorSummary[]>;
  getDoctor(doctorId: string): Promise<DoctorSummary | null>;
  /** Creates (doctorId null) or updates a doctor and replaces its specialty set atomically. */
  saveDoctor(input: {
    doctorId: string | null;
    fullName: string;
    departmentId: string | null;
    specialtyIds: string[];
    isActive: boolean;
  }): Promise<SaveOutcome>;
  listLinkableAccounts(): Promise<LinkableAccount[]>;
};

export type DirectoryResult = { ok: true } | { ok: false; message: string };

export async function saveDepartment(
  input: { id: string | null } & DepartmentInput,
  store: DirectoryStore,
): Promise<DirectoryResult> {
  const outcome = await store.saveDepartment(input);
  if (outcome === "duplicate") {
    return { ok: false, message: "A department with that name or code already exists." };
  }
  if (outcome === "not_found") {
    return { ok: false, message: "That department no longer exists." };
  }
  return { ok: true };
}

export async function saveSpecialty(
  input: { id: string | null } & SpecialtyInput,
  store: DirectoryStore,
): Promise<DirectoryResult> {
  const outcome = await store.saveSpecialty(input);
  if (outcome === "duplicate") {
    return { ok: false, message: "A specialty with that name already exists." };
  }
  if (outcome === "not_found") {
    return { ok: false, message: "That specialty no longer exists." };
  }
  return { ok: true };
}

/**
 * Creates or updates a doctor. `doctorId` identifies an existing doctor to
 * update; on create, `profileId` optionally links a registered account. Both
 * are checked against the store so a crafted form cannot promote an arbitrary
 * profile (for example an admin) to the doctor role.
 */
export async function saveDoctor(
  input: { doctorId: string | null } & DoctorInput,
  store: DirectoryStore,
): Promise<DirectoryResult> {
  let targetId: string | null = null;
  if (input.doctorId) {
    const existing = await store.getDoctor(input.doctorId);
    if (!existing) {
      return { ok: false, message: "That doctor no longer exists." };
    }
    targetId = existing.id;
  } else if (input.profileId) {
    const accounts = await store.listLinkableAccounts();
    if (!accounts.some((account) => account.profileId === input.profileId)) {
      return { ok: false, message: "That account cannot be linked as a doctor." };
    }
    targetId = input.profileId;
  }

  const [departments, specialties] = await Promise.all([
    store.listDepartments(),
    store.listSpecialties(),
  ]);
  if (
    input.departmentId &&
    !departments.some(
      (department) => department.id === input.departmentId && department.isActive,
    )
  ) {
    return { ok: false, message: "Choose an active department." };
  }
  const activeSpecialtyIds = new Set(
    specialties.filter((specialty) => specialty.isActive).map((specialty) => specialty.id),
  );
  if (!input.specialtyIds.every((id) => activeSpecialtyIds.has(id))) {
    return { ok: false, message: "Choose active specialties only." };
  }

  const outcome = await store.saveDoctor({
    doctorId: targetId,
    fullName: input.fullName,
    departmentId: input.departmentId,
    specialtyIds: input.specialtyIds,
    isActive: input.isActive,
  });
  if (outcome === "not_found") {
    return { ok: false, message: "That doctor no longer exists." };
  }
  return { ok: true };
}

/** Patient-facing doctor list: active doctors only, optionally filtered. */
export async function listBookableDoctors(
  filter: { departmentId?: string; specialtyId?: string },
  store: DirectoryStore,
): Promise<DoctorSummary[]> {
  return store.listDoctors({
    departmentId: filter.departmentId,
    specialtyId: filter.specialtyId,
    activeOnly: true,
  });
}
