"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardHeader, DetailList } from "@/components/ui/card";
import { Alert } from "@/components/ui/data";
import { Field, FieldGrid, FormFooter, Input } from "@/components/ui/field";
import { formatManilaTime } from "@/lib/appointments/format";
import {
  RESCHEDULE_REASONS,
  RESCHEDULE_REASON_LABELS,
} from "@/lib/front-desk/decisions";
import {
  rescheduleAppointmentAction,
  type RequestDecisionState,
} from "@/server/front-desk/actions";

import { ReasonFields } from "./reason-fields";
import { SlotChips } from "./slot-chips";

const IDLE_STATE: RequestDecisionState = { status: "idle" };


/**
 * Picks a new slot with the same doctor and a reason (SPEC-frontdesk §9).
 * `slots` comes from the doctor's real availability; the database re-checks
 * the chosen slot, and success returns to the details only after it commits.
 * Laid out as the reference: the form card beside a change summary that
 * follows the picked slot. `dateControl` is the page's date (GET) form; it
 * sits in the same card but outside this POST form.
 */
export function RescheduleForm({
  appointmentId,
  currentLabel,
  doctorName,
  dateLabel,
  dateControl,
  slots,
  detailsHref,
}: {
  appointmentId: string;
  currentLabel: string;
  doctorName: string;
  dateLabel: string;
  dateControl?: ReactNode;
  slots: readonly { start: string; end: string }[];
  detailsHref: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    rescheduleAppointmentAction,
    IDLE_STATE,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.push(detailsHref);
    }
  }, [state, router, detailsHref]);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="flex min-w-0 flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-soft">
        <FieldGrid>
          <Field label="Doctor" htmlFor={`reschedule-doctor-${appointmentId}`}>
            <Input id={`reschedule-doctor-${appointmentId}`} value={doctorName} disabled readOnly />
          </Field>
          {dateControl}
        </FieldGrid>
        <form action={formAction} className="flex flex-col">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          {slots.length === 0 ? (
            <p className="text-sm text-ink-muted">No free slots on this date. Choose another date.</p>
          ) : (
            <>
              <SlotChips
                legend={`Free times · ${dateLabel}`}
                name="scheduledAt"
                slots={slots}
                onSelect={setPicked}
              />
              <ReasonFields
                idPrefix={`reschedule-${appointmentId}`}
                reasons={RESCHEDULE_REASONS}
                labels={RESCHEDULE_REASON_LABELS}
                note="The doctor and status stay the same. The previous time is kept in the history."
              />
              {state.status === "error" ? (
                <p role="alert" className="mt-3 text-sm text-danger-soft-ink">
                  {state.message}
                </p>
              ) : null}
              <div className="mt-5">
                <FormFooter>
                  <LinkButton variant="ghost" size="sm" href={detailsHref}>
                    Cancel
                  </LinkButton>
                  <Button type="submit" size="sm" disabled={pending} aria-busy={pending || undefined}>
                    {pending ? "Rescheduling…" : "Reschedule appointment"}
                  </Button>
                </FormFooter>
              </div>
            </>
          )}
        </form>
      </div>
      <Card>
        <CardHeader title="Change summary" />
        <DetailList
          termWidth="4rem"
          items={[
            ["From", <span key="from" className="tabular-nums text-ink-muted line-through">{currentLabel}</span>],
            [
              "To",
              <span key="to" className="font-medium tabular-nums">
                {picked ? `${dateLabel}, ${formatManilaTime(picked)}` : "Pick a time"}
              </span>,
            ],
            ["Doctor", `${doctorName} (same)`],
          ]}
        />
        <Alert tone="info" className="mt-4">
          The patient sees the new time in CamiConnect.
        </Alert>
      </Card>
    </div>
  );
}
