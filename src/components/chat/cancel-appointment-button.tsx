"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  cancelPatientAppointmentAction,
  type AppointmentActionState,
} from "@/server/appointments/actions";

const IDLE_STATE: AppointmentActionState = { status: "idle" };

const BUTTON_BASE =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none";

/**
 * Cancel for one upcoming appointment on the My appointments page. A modal
 * confirm comes first; the server re-checks ownership and status.
 */
export function CancelAppointmentButton({
  appointmentId,
  doctorName,
  whenLabel,
}: {
  appointmentId: string;
  doctorName: string;
  whenLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    cancelPatientAppointmentAction,
    IDLE_STATE,
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      dialogRef.current?.close();
    }
  }, [state]);

  const titleId = `cancel-title-${appointmentId}`;
  const closeDialog = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        aria-label={`Cancel appointment with ${doctorName} on ${whenLabel}`}
        onClick={() => {
          setIsOpen(true);
          dialogRef.current?.showModal();
        }}
        className={`${BUTTON_BASE} border-line-strong bg-surface text-danger hover:bg-danger-soft`}
      >
        Cancel
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="dialog-motion m-auto w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-overlay backdrop:bg-overlay"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
      >
        {isOpen ? (
          <form action={formAction}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              Cancel this appointment?
            </h2>
            <p className="mt-2 text-sm text-ink-secondary">
              {doctorName} · {whenLabel}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              To change the time, cancel and book a new appointment.
            </p>
            {state.status === "error" ? (
              <p role="alert" className="mt-3 text-sm text-danger-soft-ink">
                {state.message}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeDialog}
                className={`${BUTTON_BASE} border-transparent bg-transparent text-ink hover:bg-surface-muted`}
              >
                Keep appointment
              </button>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending || undefined}
                className={`${BUTTON_BASE} border-danger bg-danger text-danger-ink hover:bg-danger-hover`}
              >
                {pending ? "Cancelling…" : "Yes, cancel it"}
              </button>
            </div>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
