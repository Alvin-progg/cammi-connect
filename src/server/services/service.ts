import "server-only";

import { SERVICE_REFUSAL_MESSAGES, serviceRefusalFromCode } from "@/lib/services/refusals";
import type { ServiceFormInput } from "@/lib/services/schemas";
import type { HospitalService, ServiceStatusFilter } from "@/lib/services/types";

type DatabaseOutcome = { ok: true } | { ok: false; code: string | undefined };

export type ServiceListFilters = { departmentId?: string; status: ServiceStatusFilter };

/**
 * Data access for admin service management. Callers authorize first, and
 * `actorId` must come from the admin session.
 */
export type ServiceAdminStore = {
  listServices(filters: ServiceListFilters): Promise<HospitalService[]>;
  getService(serviceId: string): Promise<HospitalService | null>;
  save(
    input: { actorId: string; serviceId: string | null } & ServiceFormInput,
  ): Promise<{ ok: true; serviceId: string } | { ok: false; code: string | undefined }>;
  setActive(input: {
    actorId: string;
    serviceId: string;
    isActive: boolean;
  }): Promise<DatabaseOutcome>;
};

const GENERIC_FAILURE = "Something went wrong. Try again.";

function refusalMessage(code: string | undefined): string {
  const refusal = serviceRefusalFromCode(code);
  return refusal ? SERVICE_REFUSAL_MESSAGES[refusal] : GENERIC_FAILURE;
}

export function listServices(
  filters: ServiceListFilters,
  store: ServiceAdminStore,
): Promise<HospitalService[]> {
  return store.listServices(filters);
}

export function getServiceDetail(
  serviceId: string,
  store: ServiceAdminStore,
): Promise<HospitalService | null> {
  return store.getService(serviceId);
}

export async function saveService(
  {
    actorId,
    serviceId,
    input,
  }: { actorId: string; serviceId: string | null; input: ServiceFormInput },
  store: ServiceAdminStore,
): Promise<{ ok: true; serviceId: string; message: string } | { ok: false; message: string }> {
  const saved = await store.save({ actorId, serviceId, ...input });
  if (!saved.ok) {
    return { ok: false, message: refusalMessage(saved.code) };
  }
  return { ok: true, serviceId: saved.serviceId, message: "Service saved." };
}

/** Activates or deactivates a service. Nothing blocks either change. */
export async function setServiceActive(
  input: { actorId: string; serviceId: string; isActive: boolean },
  store: ServiceAdminStore,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const outcome = await store.setActive(input);
  if (!outcome.ok) {
    return { ok: false, message: refusalMessage(outcome.code) };
  }
  return { ok: true, message: input.isActive ? "Service activated." : "Service deactivated." };
}
