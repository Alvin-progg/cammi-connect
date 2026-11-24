"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { updatePatientProfileAction, type ProfileActionState } from "@/server/profiles/actions";

const IDLE_STATE: ProfileActionState = { status: "idle" };

export function PatientProfileForm({
  initialFullName,
  initialPhone,
}: {
  initialFullName: string;
  initialPhone: string;
}) {
  const [state, formAction, pending] = useActionState(updatePatientProfileAction, IDLE_STATE);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4 px-4 py-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-full-name">Full name</Label>
        <Input
          id="profile-full-name"
          name="fullName"
          autoComplete="name"
          defaultValue={initialFullName}
          maxLength={100}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-phone">Phone number</Label>
        <Input
          id="profile-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={initialPhone}
          maxLength={32}
          placeholder="+63 917 555 0100"
        />
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
