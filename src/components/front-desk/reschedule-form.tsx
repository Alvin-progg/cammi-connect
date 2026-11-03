"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

const IDLE_STATE: RequestDecisionState = { status: "idle" };


/**
 * Picks a new slot with the same doctor and a reason (SPEC-frontdesk §9).
 * `slots` comes from the doctor's real availability; the database re-checks
 * the chosen slot, and success returns to the details only after it commits.
 */
export function RescheduleForm({
  appointmentId,
  currentLabel,
  slots,
  detailsHref,
}: {
  appointmentId: string;
  currentLabel: string;
  slots: readonly { start: string; end: string }[];
  detailsHref: string;
}) {
  const router = useRouter();
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
    <form action={formAction} className="flex flex-col">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <p className="text-sm text-ink-secondary">
        Current time: <span className="font-medium text-ink">{currentLabel}</span>
      </p>
      {slots.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          No free slots on this date. Choose another date.
        </p>
      ) : (
        <>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-ink">New time</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((slot) => (
                <label
                  key={slot.start}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink pressable hover:bg-surface-muted has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="radio"
                    name="scheduledAt"
                    value={slot.start}
                    required
                    className="size-4 accent-primary"
                  />
                  {formatManilaTime(slot.start)}
                </label>
              ))}
            </div>
          </fieldset>
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
            <Button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? "Rescheduling…" : "Reschedule appointment"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
