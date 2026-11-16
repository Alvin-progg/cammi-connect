"use client";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { centavosToPesoInput } from "@/lib/billing/money";
import type { HmoProvider } from "@/lib/hmo-providers/types";
import {
  saveHmoProviderAction,
  type HmoProviderActionState,
} from "@/server/hmo-providers/actions";

const IDLE_STATE: HmoProviderActionState = { status: "idle" };

/** Creates an HMO provider, or edits one's name, co-pay, and notes. */
export function HmoProviderForm({ provider }: { provider?: HmoProvider }) {
  const { state, formAction, pending } = useAdminForm(saveHmoProviderAction, IDLE_STATE);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {provider ? <input type="hidden" name="hmoProviderId" value={provider.id} /> : null}
      <Field id="hmo-name" label="Name">
        <input
          id="hmo-name"
          name="name"
          required
          maxLength={100}
          defaultValue={provider?.name}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="hmo-copay" label="Co-pay (₱)">
        <input
          id="hmo-copay"
          name="copay"
          inputMode="decimal"
          aria-describedby="hmo-copay-help"
          defaultValue={provider ? centavosToPesoInput(provider.copayCentavos) : ""}
          className={FIELD_CLASS}
        />
        <p id="hmo-copay-help" className="text-xs text-ink-muted">
          What the patient still pays after the HMO approves. Leave blank for none.
        </p>
      </Field>
      <Field id="hmo-notes" label="Notes">
        <textarea
          id="hmo-notes"
          name="notes"
          maxLength={500}
          rows={3}
          defaultValue={provider?.notes ?? ""}
          className={`${FIELD_CLASS} py-2`}
        />
      </Field>
      <FormFooter
        state={state}
        pending={pending}
        label={provider ? "Save HMO provider" : "Create HMO provider"}
      />
    </form>
  );
}
