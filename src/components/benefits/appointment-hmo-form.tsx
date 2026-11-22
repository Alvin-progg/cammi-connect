"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { AUTHORIZATION_LABELS, COVERAGE_LABELS } from "@/lib/benefits/labels";
import { AUTHORIZATION_STATUSES, COVERAGE_STATUSES, type AuthorizationStatus, type CoverageStatus } from "@/lib/benefits/types";
import { updateAppointmentHmoAction, type BenefitActionState } from "@/server/benefits/actions";

const INITIAL: BenefitActionState = { status: "idle" };

/** Authorization and coverage for one appointment; each is saved as chosen, not derived. */
export function AppointmentHmoForm({
  appointmentId,
  authorization,
  coverage,
  loaNumber,
  remarks,
}: {
  appointmentId: string;
  authorization: AuthorizationStatus;
  coverage: CoverageStatus;
  loaNumber: string | null;
  remarks: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateAppointmentHmoAction, INITIAL);

  return (
    <form action={formAction} className="grid gap-3 border-t border-line pt-4">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hmo-authorization" className="text-xs font-medium text-ink-muted">Authorization</label>
          <Select id="hmo-authorization" name="authorization" defaultValue={authorization}>
            {AUTHORIZATION_STATUSES.map((status: AuthorizationStatus) => (
              <option key={status} value={status}>{AUTHORIZATION_LABELS[status]}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hmo-coverage" className="text-xs font-medium text-ink-muted">Coverage</label>
          <Select id="hmo-coverage" name="coverage" defaultValue={coverage}>
            {COVERAGE_STATUSES.map((status: CoverageStatus) => (
              <option key={status} value={status}>{COVERAGE_LABELS[status]}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hmo-loa" className="text-xs font-medium text-ink-muted">LOA number</label>
        <Input id="hmo-loa" name="loaNumber" maxLength={100} defaultValue={loaNumber ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hmo-remarks" className="text-xs font-medium text-ink-muted">Remarks</label>
        <Textarea id="hmo-remarks" name="remarks" rows={2} maxLength={500} defaultValue={remarks ?? ""} />
      </div>
      {state.status === "error" ? <p role="alert" className="text-xs text-danger">{state.message}</p> : null}
      {state.status === "success" ? <p role="status" className="text-xs text-success">{state.message}</p> : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save HMO details"}</Button>
      </div>
    </form>
  );
}
