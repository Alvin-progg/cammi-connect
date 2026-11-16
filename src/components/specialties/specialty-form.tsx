"use client";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { centavosToPesoInput } from "@/lib/billing/money";
import type { SpecialtyDetail } from "@/lib/specialties/types";
import { ROUTING_HINTS_MAX_LENGTH } from "@/lib/specialties/schemas";
import { saveSpecialtyAction, type SpecialtyActionState } from "@/server/specialties/actions";

const IDLE_STATE: SpecialtyActionState = { status: "idle" };

/** Creates a specialty, or edits one's name, description, routing hints, and default fee. */
export function SpecialtyForm({ specialty }: { specialty?: SpecialtyDetail }) {
  const { state, formAction, pending } = useAdminForm(saveSpecialtyAction, IDLE_STATE);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {specialty ? <input type="hidden" name="specialtyId" value={specialty.id} /> : null}
      <Field id="specialty-name" label="Name">
        <input
          id="specialty-name"
          name="name"
          required
          maxLength={100}
          defaultValue={specialty?.name}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="specialty-description" label="Description">
        <textarea
          id="specialty-description"
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={specialty?.description ?? ""}
          className={`${FIELD_CLASS} py-2`}
        />
      </Field>
      <Field id="specialty-routing-hints" label="Routing hints">
        <textarea
          id="specialty-routing-hints"
          name="routingHints"
          aria-describedby="specialty-routing-hints-help"
          maxLength={ROUTING_HINTS_MAX_LENGTH}
          rows={4}
          defaultValue={specialty?.routingHints ?? ""}
          className={`${FIELD_CLASS} py-2`}
        />
        <p id="specialty-routing-hints-help" className="text-xs text-ink-muted">
          Who should book here, in plain language, so Cami can suggest this specialty. Have
          medical staff review it. Patients never see it.
        </p>
      </Field>
      <Field id="specialty-default-fee" label="Default consultation fee (₱)">
        <input
          id="specialty-default-fee"
          name="defaultConsultationFee"
          inputMode="decimal"
          aria-describedby="specialty-default-fee-help"
          defaultValue={centavosToPesoInput(specialty?.defaultConsultationFeeCentavos ?? null)}
          className={FIELD_CLASS}
        />
        <p id="specialty-default-fee-help" className="text-xs text-ink-muted">
          Charged when a doctor has no fee of their own. Leave blank if not set yet.
        </p>
      </Field>
      <FormFooter
        state={state}
        pending={pending}
        label={specialty ? "Save specialty" : "Create specialty"}
      />
    </form>
  );
}
