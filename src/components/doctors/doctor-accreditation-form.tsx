"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ACCREDITATION_STATUSES } from "@/lib/benefits/types";
import { ACCREDITATION_LABELS } from "@/lib/benefits/labels";
import { saveAccreditationAction, type BenefitActionState } from "@/server/benefits/actions";

const INITIAL: BenefitActionState = { status: "idle" };

/**
 * Add or update one provider for a doctor. Saving an existing provider
 * updates its status and dates (one row per doctor and provider).
 */
export function DoctorAccreditationForm({
  doctorId,
  providers,
}: {
  doctorId: string;
  providers: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveAccreditationAction, INITIAL);

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="doctorId" value={doctorId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="accreditation-provider" className="text-sm font-medium text-ink">HMO provider</label>
        <Select id="accreditation-provider" name="providerId" required defaultValue="">
          <option value="" disabled>Choose a provider</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.name}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="accreditation-status" className="text-sm font-medium text-ink">Status</label>
        <Select id="accreditation-status" name="status" required defaultValue="active">
          {ACCREDITATION_STATUSES.map((status) => (
            <option key={status} value={status}>{ACCREDITATION_LABELS[status]}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="accreditation-from" className="text-sm font-medium text-ink">Valid from</label>
        <Input id="accreditation-from" name="validFrom" type="date" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="accreditation-until" className="text-sm font-medium text-ink">Valid until (blank for no end)</label>
        <Input id="accreditation-until" name="validUntil" type="date" />
      </div>
      <div className="flex flex-col gap-2 md:col-span-2">
        {state.status === "error" ? <p role="alert" className="text-sm text-danger">{state.message}</p> : null}
        {state.status === "success" ? <p role="status" className="text-sm text-success">{state.message}</p> : null}
        <div>
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save accreditation"}</Button>
        </div>
      </div>
    </form>
  );
}
