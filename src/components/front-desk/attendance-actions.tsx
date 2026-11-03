"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ATTENDANCE_ACTION_LABELS,
  type AttendanceStatus,
} from "@/lib/front-desk/schedule";
import {
  recordAttendanceAction,
  type RequestDecisionState,
} from "@/server/front-desk/actions";

const IDLE_STATE: RequestDecisionState = { status: "idle" };

const BUTTON_BASE =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none";
const PRIMARY_BUTTON = `${BUTTON_BASE} border-primary bg-primary text-primary-ink hover:bg-primary-hover`;
const SECONDARY_BUTTON = `${BUTTON_BASE} border-line-strong bg-surface text-ink hover:bg-surface-muted`;
const OUTLINE_DANGER_BUTTON = `${BUTTON_BASE} border-line-strong bg-surface text-danger hover:bg-danger-soft`;
const DANGER_BUTTON = `${BUTTON_BASE} border-danger bg-danger text-danger-ink hover:bg-danger-hover`;
const QUIET_BUTTON = `${BUTTON_BASE} border-transparent bg-transparent text-ink hover:bg-surface-muted`;

/**
 * Check-in, completed, and no-show controls for one appointment
 * (SPEC-frontdesk §8). `actions` comes from `allowedAttendanceActions`; the
 * server re-checks the role, the transition, and the day before saving, and
 * success is announced only after it commits. No-show asks first because it
 * cannot be undone.
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
  const [confirmingNoShow, setConfirmingNoShow] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  if (actions.length === 0) {
    return null;
  }

  function submitButton(status: AttendanceStatus, label: string, className: string) {
    return (
      // Leaving the no-show confirmation on submit keeps one step per click;
      // a refusal shows below the regular buttons.
      <form action={formAction} onSubmit={() => setConfirmingNoShow(false)}>
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="status" value={status} />
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={className}
        >
          {label}
        </button>
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
        {confirmingNoShow ? (
          <>
            {submitButton("no_show", "Confirm no-show", DANGER_BUTTON)}
            <button
              type="button"
              onClick={() => setConfirmingNoShow(false)}
              className={QUIET_BUTTON}
            >
              Go back
            </button>
          </>
        ) : (
          <>
            {actions.includes("checked_in")
              ? submitButton("checked_in", ATTENDANCE_ACTION_LABELS.checked_in, PRIMARY_BUTTON)
              : null}
            {actions.includes("completed")
              ? submitButton("completed", ATTENDANCE_ACTION_LABELS.completed, SECONDARY_BUTTON)
              : null}
            {actions.includes("no_show") ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmingNoShow(true)}
                className={OUTLINE_DANGER_BUTTON}
              >
                {ATTENDANCE_ACTION_LABELS.no_show}
              </button>
            ) : null}
          </>
        )}
      </div>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
