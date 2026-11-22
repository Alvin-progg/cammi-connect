"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { decideBenefitAction, type BenefitActionState } from "@/server/benefits/actions";
import type { BenefitKind } from "@/server/benefits/service";

const INITIAL: BenefitActionState = { status: "idle" };

/** Verify, or reject with a reason, for one pending PWD or HMO record. */
export function BenefitDecisionForm({ kind, recordId }: { kind: BenefitKind; recordId: string }) {
  const [state, formAction, pending] = useActionState(decideBenefitAction, INITIAL);
  const reasonId = `reason-${kind}-${recordId}`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="recordId" value={recordId} />
      <label htmlFor={reasonId} className="text-xs font-medium text-ink-muted">
        Reason (required to reject)
      </label>
      <Textarea id={reasonId} name="reason" rows={2} maxLength={500} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="verify" size="sm" disabled={pending}>
          Verify
        </Button>
        <Button type="submit" name="decision" value="reject" variant="outline" size="sm" disabled={pending}>
          Reject
        </Button>
      </div>
      {state.status === "error" ? <p role="alert" className="text-xs text-danger">{state.message}</p> : null}
      {state.status === "success" ? <p role="status" className="text-xs text-success">{state.message}</p> : null}
    </form>
  );
}
