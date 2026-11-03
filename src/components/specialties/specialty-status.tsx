"use client";

import { FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { Specialty } from "@/lib/directory/types";
import {
  setSpecialtyActiveAction,
  type SpecialtyActionState,
} from "@/server/specialties/actions";

const IDLE_STATE: SpecialtyActionState = { status: "idle" };

export function SpecialtyStatusForm({ specialty }: { specialty: Specialty }) {
  const { state, formAction, pending } = useAdminForm(setSpecialtyActiveAction, IDLE_STATE);
  const nextActive = !specialty.isActive;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="specialtyId" value={specialty.id} />
      <input type="hidden" name="isActive" value={String(nextActive)} />
      <p className="text-sm text-ink-secondary">
        {specialty.isActive
          ? "A deactivated specialty is hidden from patients. Doctors and appointments that already have it keep it."
          : "Activating offers the specialty to patients again."}
      </p>
      <FormFooter
        state={state}
        pending={pending}
        label={nextActive ? "Activate specialty" : "Deactivate specialty"}
        variant={nextActive ? "primary" : "outlineDanger"}
      />
    </form>
  );
}
