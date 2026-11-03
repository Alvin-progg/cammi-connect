"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from "./dialog-styles";

import { Button, buttonVariants, type ButtonVariantProps } from "@/components/ui/button";
import {
  ATTENDANCE_ACTION_LABELS,
  type AttendanceStatus,
} from "@/lib/front-desk/schedule";
import {
  recordAttendanceAction,
  type RequestDecisionState,
} from "@/server/front-desk/actions";

const IDLE_STATE: RequestDecisionState = { status: "idle" };

const PENDING_LABELS: Record<AttendanceStatus, string> = {
  checked_in: "Checking in…",
  completed: "Completing…",
  no_show: "Recording no-show…",
};

/**
 * Check-in, completed, and no-show controls for one appointment
 * (SPEC-frontdesk §8). `actions` comes from `allowedAttendanceActions`; the
 * server re-checks the role, the transition, and the day before saving, and
 * success is announced only after it commits. No-show asks first in an alert
 * dialog because it cannot be undone.
 */
export function AttendanceActions({
  appointmentId,
  patientName,
  actions,
}: {
  appointmentId: string;
  patientName: string;
  actions: readonly AttendanceStatus[];
}) {
  const [state, formAction, pending] = useActionState(recordAttendanceAction, IDLE_STATE);
  // The no-show dialog stays open while saving so its button can name the
  // work, and closes once the server answers: it is open only while the
  // action state is still the one it was opened at. A refusal then shows
  // below the row's buttons like any other.
  const [noShowOpenedAt, setNoShowOpenedAt] = useState<RequestDecisionState | null>(null);
  const noShowOpen = noShowOpenedAt === state;
  // Which button started the pending save, so only that one names the work.
  const [submittedStatus, setSubmittedStatus] = useState<AttendanceStatus | null>(null);
  const goBackRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  if (actions.length === 0) {
    return null;
  }

  function submitButton(
    status: AttendanceStatus,
    label: string,
    variant: ButtonVariantProps["variant"],
  ) {
    return (
      <form action={formAction} onSubmit={() => setSubmittedStatus(status)}>
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="status" value={status} />
        <Button
          type="submit"
          variant={variant}
          size="sm"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending && submittedStatus === status ? PENDING_LABELS[status] : label}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={`Attendance for ${patientName}`}
        className="flex flex-wrap gap-2"
      >
        {actions.includes("checked_in")
          ? submitButton("checked_in", ATTENDANCE_ACTION_LABELS.checked_in, "primary")
          : null}
        {actions.includes("completed")
          ? submitButton("completed", ATTENDANCE_ACTION_LABELS.completed, "secondary")
          : null}
        {actions.includes("no_show") ? (
          <AlertDialog.Root
            open={noShowOpen}
            onOpenChange={(open) => {
              // Keep the dialog up until the save settles.
              if (!pending) setNoShowOpenedAt(open ? state : null);
            }}
          >
            <AlertDialog.Trigger
              disabled={pending}
              className={buttonVariants({ variant: "outlineDanger", size: "sm" })}
            >
              {ATTENDANCE_ACTION_LABELS.no_show}
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className={DIALOG_BACKDROP_CLASS} />
              <AlertDialog.Popup initialFocus={goBackRef} className={DIALOG_POPUP_CLASS}>
                <AlertDialog.Title className="text-lg font-semibold text-ink">
                  {`Mark ${patientName} as a no-show?`}
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-sm text-ink-secondary">
                  The appointment closes as a no-show. This can&apos;t be undone.
                </AlertDialog.Description>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <AlertDialog.Close
                    ref={goBackRef}
                    disabled={pending}
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    Go back
                  </AlertDialog.Close>
                  {submitButton("no_show", "Confirm no-show", "danger")}
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ) : null}
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
