import "server-only";

import {
  HMO_PROVIDER_REFUSAL_MESSAGES,
  hmoProviderRefusalFromCode,
} from "@/lib/hmo-providers/refusals";
import type { HmoProviderFormInput } from "@/lib/hmo-providers/schemas";
import type { HmoProvider } from "@/lib/hmo-providers/types";

type DatabaseOutcome = { ok: true } | { ok: false; code: string | undefined };

/**
 * Data access for admin HMO provider management. Callers authorize first, and
 * `actorId` must come from the admin session.
 */
export type HmoProviderAdminStore = {
  listHmoProviders(): Promise<HmoProvider[]>;
  getHmoProvider(hmoProviderId: string): Promise<HmoProvider | null>;
  save(
    input: { actorId: string; hmoProviderId: string | null } & HmoProviderFormInput,
  ): Promise<{ ok: true; hmoProviderId: string } | { ok: false; code: string | undefined }>;
  setActive(input: {
    actorId: string;
    hmoProviderId: string;
    isActive: boolean;
  }): Promise<DatabaseOutcome>;
};

const GENERIC_FAILURE = "Something went wrong. Try again.";

function refusalMessage(code: string | undefined): string {
  const refusal = hmoProviderRefusalFromCode(code);
  return refusal ? HMO_PROVIDER_REFUSAL_MESSAGES[refusal] : GENERIC_FAILURE;
}

export function listHmoProviders(store: HmoProviderAdminStore): Promise<HmoProvider[]> {
  return store.listHmoProviders();
}

export function getHmoProvider(
  hmoProviderId: string,
  store: HmoProviderAdminStore,
): Promise<HmoProvider | null> {
  return store.getHmoProvider(hmoProviderId);
}

export async function saveHmoProvider(
  {
    actorId,
    hmoProviderId,
    input,
  }: { actorId: string; hmoProviderId: string | null; input: HmoProviderFormInput },
  store: HmoProviderAdminStore,
): Promise<{ ok: true; hmoProviderId: string; message: string } | { ok: false; message: string }> {
  const saved = await store.save({ actorId, hmoProviderId, ...input });
  if (!saved.ok) {
    return { ok: false, message: refusalMessage(saved.code) };
  }
  return { ok: true, hmoProviderId: saved.hmoProviderId, message: "HMO provider saved." };
}

/** Activates or deactivates an HMO provider. Nothing blocks either change. */
export async function setHmoProviderActive(
  input: { actorId: string; hmoProviderId: string; isActive: boolean },
  store: HmoProviderAdminStore,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const outcome = await store.setActive(input);
  if (!outcome.ok) {
    return { ok: false, message: refusalMessage(outcome.code) };
  }
  return {
    ok: true,
    message: input.isActive ? "HMO provider activated." : "HMO provider deactivated.",
  };
}
