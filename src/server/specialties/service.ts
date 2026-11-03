import "server-only";

import type { Specialty, DoctorSummary } from "@/lib/directory/types";
import {
  SPECIALTY_REFUSAL_MESSAGES,
  specialtyRefusalFromCode,
} from "@/lib/specialties/refusals";
import type { SpecialtyFormInput } from "@/lib/specialties/schemas";
import type { SpecialtyOverview } from "@/lib/specialties/types";

type DatabaseOutcome = { ok: true } | { ok: false; code: string | undefined };

/**
 * Data access for admin specialty management. Callers authorize first, and
 * `actorId` must come from the admin session.
 */
export type SpecialtyAdminStore = {
  listSpecialties(): Promise<Specialty[]>;
  countDoctorsBySpecialty(): Promise<Map<string, number>>;
  getSpecialty(specialtyId: string): Promise<Specialty | null>;
  /** Every doctor with the specialty, active or not. */
  listDoctors(specialtyId: string): Promise<DoctorSummary[]>;
  save(input: {
    actorId: string;
    specialtyId: string | null;
    name: string;
    description: string | null;
  }): Promise<{ ok: true; specialtyId: string } | { ok: false; code: string | undefined }>;
  setActive(input: {
    actorId: string;
    specialtyId: string;
    isActive: boolean;
  }): Promise<DatabaseOutcome>;
};

const GENERIC_FAILURE = "Something went wrong. Try again.";

function refusalMessage(code: string | undefined): string {
  const refusal = specialtyRefusalFromCode(code);
  return refusal ? SPECIALTY_REFUSAL_MESSAGES[refusal] : GENERIC_FAILURE;
}

export async function listSpecialtiesOverview(
  store: SpecialtyAdminStore,
): Promise<SpecialtyOverview[]> {
  const [specialties, doctorCounts] = await Promise.all([
    store.listSpecialties(),
    store.countDoctorsBySpecialty(),
  ]);
  return specialties.map((specialty) => ({
    ...specialty,
    doctorCount: doctorCounts.get(specialty.id) ?? 0,
  }));
}

export async function getSpecialtyDetail(
  specialtyId: string,
  store: SpecialtyAdminStore,
): Promise<{ specialty: Specialty; doctors: DoctorSummary[] } | null> {
  const specialty = await store.getSpecialty(specialtyId);
  if (!specialty) {
    return null;
  }
  return { specialty, doctors: await store.listDoctors(specialtyId) };
}

export async function saveSpecialty(
  {
    actorId,
    specialtyId,
    input,
  }: { actorId: string; specialtyId: string | null; input: SpecialtyFormInput },
  store: SpecialtyAdminStore,
): Promise<{ ok: true; specialtyId: string; message: string } | { ok: false; message: string }> {
  const saved = await store.save({ actorId, specialtyId, ...input });
  if (!saved.ok) {
    return { ok: false, message: refusalMessage(saved.code) };
  }
  return { ok: true, specialtyId: saved.specialtyId, message: "Specialty saved." };
}

/**
 * Activates or deactivates a specialty. Nothing blocks deactivation (spec
 * §7): doctors and appointments keep the specialty, and patients stop seeing
 * it as a choice.
 */
export async function setSpecialtyActive(
  input: { actorId: string; specialtyId: string; isActive: boolean },
  store: SpecialtyAdminStore,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const outcome = await store.setActive(input);
  if (!outcome.ok) {
    return { ok: false, message: refusalMessage(outcome.code) };
  }
  return {
    ok: true,
    message: input.isActive ? "Specialty activated." : "Specialty deactivated.",
  };
}
