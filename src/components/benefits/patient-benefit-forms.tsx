"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import {
  submitHmoAction,
  submitPwdAction,
  type BenefitActionState,
} from "@/server/benefits/actions";

const INITIAL: BenefitActionState = { status: "idle" };

function FeedbackMessage({ state }: { state: BenefitActionState }) {
  if (state.status === "error") return <p role="alert" className="text-sm text-danger">{state.message}</p>;
  if (state.status === "success") return <p role="status" className="text-sm text-success">{state.message}</p>;
  return null;
}

export function PwdForm({ submitLabel }: { submitLabel: string }) {
  const [state, formAction, pending] = useActionState(submitPwdAction, INITIAL);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pwd-id-number" className="text-sm font-medium text-ink">PWD ID number</label>
        <Input id="pwd-id-number" name="idNumber" required maxLength={50} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pwd-id-image" className="text-sm font-medium text-ink">Photo of your PWD ID</label>
        <Input id="pwd-id-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
        <span className="text-xs text-ink-muted">JPEG, PNG, or WebP, up to 5 MB.</span>
      </div>
      <FeedbackMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : submitLabel}</Button>
    </form>
  );
}

export function HmoForm({
  providers,
  submitLabel,
}: {
  providers: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(submitHmoAction, INITIAL);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hmo-provider" className="text-sm font-medium text-ink">HMO provider</label>
        <Select id="hmo-provider" name="providerId" required defaultValue="">
          <option value="" disabled>Choose a provider</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.name}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hmo-membership" className="text-sm font-medium text-ink">Membership number</label>
        <Input id="hmo-membership" name="membershipNumber" required maxLength={50} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="hmo-card" className="text-sm font-medium text-ink">HMO card photo (optional)</label>
        <Input id="hmo-card" name="card" type="file" accept="image/jpeg,image/png,image/webp" />
      </div>
      <FeedbackMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : submitLabel}</Button>
    </form>
  );
}
