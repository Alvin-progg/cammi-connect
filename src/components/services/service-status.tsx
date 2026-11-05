"use client";

import { FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { HospitalService } from "@/lib/services/types";
import { setServiceActiveAction, type ServiceActionState } from "@/server/services/actions";

const IDLE_STATE: ServiceActionState = { status: "idle" };

export function ServiceStatusForm({ service }: { service: HospitalService }) {
  const { state, formAction, pending } = useAdminForm(setServiceActiveAction, IDLE_STATE);
  const nextActive = !service.isActive;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="serviceId" value={service.id} />
      <input type="hidden" name="isActive" value={String(nextActive)} />
      <p className="text-sm text-ink-secondary">
        {service.isActive
          ? "A deactivated service stays on record but is marked as no longer offered."
          : "Activating marks the service as offered again."}
      </p>
      <FormFooter
        state={state}
        pending={pending}
        label={nextActive ? "Activate service" : "Deactivate service"}
        variant={nextActive ? "primary" : "outlineDanger"}
      />
    </form>
  );
}
