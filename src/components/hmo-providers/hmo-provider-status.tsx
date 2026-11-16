"use client";

import { FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { HmoProvider } from "@/lib/hmo-providers/types";
import {
  setHmoProviderActiveAction,
  type HmoProviderActionState,
} from "@/server/hmo-providers/actions";

const IDLE_STATE: HmoProviderActionState = { status: "idle" };

export function HmoProviderStatusForm({ provider }: { provider: HmoProvider }) {
  const { state, formAction, pending } = useAdminForm(setHmoProviderActiveAction, IDLE_STATE);
  const nextActive = !provider.isActive;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="hmoProviderId" value={provider.id} />
      <input type="hidden" name="isActive" value={String(nextActive)} />
      <p className="text-sm text-ink-secondary">
        {provider.isActive
          ? "A deactivated HMO stays on record but is no longer accepted for new bookings."
          : "Activating accepts this HMO again."}
      </p>
      <FormFooter
        state={state}
        pending={pending}
        label={nextActive ? "Activate HMO provider" : "Deactivate HMO provider"}
        variant={nextActive ? "primary" : "outlineDanger"}
      />
    </form>
  );
}
