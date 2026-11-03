"use client";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { Specialty } from "@/lib/directory/types";
import { saveSpecialtyAction, type SpecialtyActionState } from "@/server/specialties/actions";

const IDLE_STATE: SpecialtyActionState = { status: "idle" };

/** Creates a specialty, or edits one's name and description. */
export function SpecialtyForm({ specialty }: { specialty?: Specialty }) {
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
      <FormFooter
        state={state}
        pending={pending}
        label={specialty ? "Save specialty" : "Create specialty"}
      />
    </form>
  );
}
