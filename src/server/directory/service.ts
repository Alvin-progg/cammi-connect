import "server-only";

import type {
  Department,
  DoctorSummary,
  Specialty,
} from "@/lib/directory/types";

export type DoctorFilter = {
  departmentId?: string;
  specialtyId?: string;
  activeOnly: boolean;
};

/**
 * Read-only directory of departments, specialties, and doctors for signed-in
 * users. Admin writes live in the departments, specialties, and doctors modules.
 * `DoctorSummary` carries no contact details, so these reads are safe to show
 * patients and Cami.
 */
export type DirectoryStore = {
  listDepartments(): Promise<Department[]>;
  listSpecialties(): Promise<Specialty[]>;
  listDoctors(filter: DoctorFilter): Promise<DoctorSummary[]>;
  getDoctor(doctorId: string): Promise<DoctorSummary | null>;
};

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
