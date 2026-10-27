"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { toast } from "sonner";

import {
  cancelAppointmentAction,
  completeAppointmentAction,
  confirmAppointmentAction,
  markNoShowAppointmentAction,
  rescheduleAppointmentAction,
  type AppointmentActionState,
} from "@/server/appointments/actions";
import { canDoctorPerform } from "@/lib/appointments/transitions";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { AppointmentStatus } from "@/lib/appointments/status";

export type AppointmentHistoryItem = {
  id: string;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  reason: string | null;
  createdAtLabel: string;
};

const IDLE_STATE: AppointmentActionState = { status: "idle" };

type ServerAction = (
  previous: AppointmentActionState,
  formData: FormData,
) => Promise<AppointmentActionState>;

function useSuccessToast(
  state: AppointmentActionState,
  onSuccess?: () => void,
) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      onSuccess?.();
    }
  }, [state, onSuccess]);
}

function ActionError({ state }: { state: AppointmentActionState }) {
  if (state.status !== "error") {
    return null;
  }
  return (
    <p role="alert" className="text-sm text-danger-soft-ink">
      {state.message}
    </p>
  );
}

function PrimaryActionForm({
  action,
  appointmentId,
  label,
  pendingLabel,
  onSuccess,
}: {
  action: ServerAction;
  appointmentId: string;
  label: string;
  pendingLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);
  useSuccessToast(state, onSuccess);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? pendingLabel : label}
      </button>
      <ActionError state={state} />
    </form>
  );
}

function SecondaryActionForm({
  action,
  appointmentId,
  label,
  pendingLabel,
  onSuccess,
}: {
  action: ServerAction;
  appointmentId: string;
  label: string;
  pendingLabel: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);
  useSuccessToast(state, onSuccess);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? pendingLabel : label}
      </button>
      <ActionError state={state} />
    </form>
  );
}

function CancelForm({
  appointmentId,
  patientName,
  onSuccess,
}: {
  appointmentId: string;
  patientName: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    cancelAppointmentAction,
    IDLE_STATE,
  );
  useSuccessToast(state, onSuccess);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <label
        htmlFor={`cancel-reason-${appointmentId}`}
        className="text-sm font-medium text-ink"
      >
        Reason for cancelling {patientName}&apos;s appointment
      </label>
      <textarea
        id={`cancel-reason-${appointmentId}`}
        name="reason"
        required
        minLength={3}
        maxLength={500}
        rows={2}
        className="w-full rounded-lg border border-control-line bg-surface px-3 py-2 text-base text-ink focus-ring"
      />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-danger bg-danger px-3 text-sm font-medium text-danger-ink transition-colors hover:bg-danger-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? "Cancelling…" : "Cancel appointment"}
      </button>
      <ActionError state={state} />
    </form>
  );
}

function RescheduleForm({
  appointmentId,
  scheduleHint,
  onSuccess,
}: {
  appointmentId: string;
  scheduleHint: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    rescheduleAppointmentAction,
    IDLE_STATE,
  );
  useSuccessToast(state, onSuccess);
  const [minValue] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <label
        htmlFor={`reschedule-at-${appointmentId}`}
        className="text-sm font-medium text-ink"
      >
        New date and time (PHT)
      </label>
      <input
        id={`reschedule-at-${appointmentId}`}
        name="newScheduledAt"
        type="datetime-local"
        required
        min={minValue}
        className="min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink focus-ring"
      />
      <p className="text-xs leading-5 text-ink-muted">
        Your regular hours: {scheduleHint}
      </p>
      <label
        htmlFor={`reschedule-note-${appointmentId}`}
        className="text-sm font-medium text-ink"
      >
        Note (optional)
      </label>
      <input
        id={`reschedule-note-${appointmentId}`}
        name="note"
        type="text"
        maxLength={500}
        className="min-h-11 w-full rounded-lg border border-control-line bg-surface px-3 text-base text-ink focus-ring"
      />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-primary bg-primary px-3 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
      >
        {pending ? "Rescheduling…" : "Reschedule appointment"}
      </button>
      <ActionError state={state} />
    </form>
  );
}

function HistoryTimeline({ history }: { history: AppointmentHistoryItem[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-ink-muted">No recorded changes yet.</p>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {history.map((entry) => (
        <li
          key={entry.id}
          className="rounded-lg border border-line bg-surface-muted px-3 py-2"
        >
          <p className="text-sm text-ink">
            {entry.fromStatus && entry.fromStatus !== entry.toStatus
              ? `${APPOINTMENT_STATUS_LABELS[entry.fromStatus]} → ${APPOINTMENT_STATUS_LABELS[entry.toStatus]}`
              : APPOINTMENT_STATUS_LABELS[entry.toStatus]}
            <span className="text-ink-muted"> · {entry.createdAtLabel}</span>
          </p>
          {entry.reason ? (
            <p className="mt-0.5 text-xs leading-5 text-ink-secondary">
              {entry.reason}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * Quick action + "Manage" dialog for one appointment. The dialog groups the
 * allowed status transitions, cancellation with a recorded reason,
 * rescheduling against the doctor's availability, and the audit history.
 */
export function AppointmentActions({
  appointmentId,
  status,
  patientName,
  scheduledAtLabel,
  scheduleHint,
  history,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  patientName: string;
  scheduledAtLabel: string;
  scheduleHint: string;
  history: AppointmentHistoryItem[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = () => {
    setIsOpen(true);
    dialogRef.current?.showModal();
  };
  const closeDialog = () => dialogRef.current?.close();

  const canConfirm = canDoctorPerform(status, "confirm");
  const canComplete = canDoctorPerform(status, "complete");
  const canNoShow = canDoctorPerform(status, "no_show");
  const canCancel = canDoctorPerform(status, "cancel");
  const hasActions = canConfirm || canComplete || canNoShow || canCancel;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canConfirm ? (
        <PrimaryActionForm
          action={confirmAppointmentAction}
          appointmentId={appointmentId}
          label="Confirm"
          pendingLabel="Confirming…"
        />
      ) : null}
      {canComplete ? (
        <PrimaryActionForm
          action={completeAppointmentAction}
          appointmentId={appointmentId}
          label="Complete"
          pendingLabel="Completing…"
        />
      ) : null}
      <button
        type="button"
        onClick={openDialog}
        className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted motion-reduce:transition-none"
      >
        Manage
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`manage-title-${appointmentId}`}
        className="m-auto w-full max-w-lg rounded-2xl border border-line bg-surface p-6 text-ink shadow-overlay backdrop:bg-overlay"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeDialog();
          }
        }}
      >
        {isOpen ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id={`manage-title-${appointmentId}`}
                  className="text-xl font-semibold text-ink"
                >
                  {patientName}
                </h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  {scheduledAtLabel} · {APPOINTMENT_STATUS_LABELS[status]}
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={closeDialog}
                aria-label="Close"
                className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted motion-reduce:transition-none"
              >
                Close
              </button>
            </div>

            {hasActions ? (
              <div className="mt-5 flex flex-col gap-5">
                {canConfirm ? (
                  <PrimaryActionForm
                    action={confirmAppointmentAction}
                    appointmentId={appointmentId}
                    label="Confirm request"
                    pendingLabel="Confirming…"
                    onSuccess={closeDialog}
                  />
                ) : null}
                {canComplete || canNoShow ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {canComplete ? (
                      <SecondaryActionForm
                        action={completeAppointmentAction}
                        appointmentId={appointmentId}
                        label="Mark completed"
                        pendingLabel="Completing…"
                        onSuccess={closeDialog}
                      />
                    ) : null}
                    {canNoShow ? (
                      <SecondaryActionForm
                        action={markNoShowAppointmentAction}
                        appointmentId={appointmentId}
                        label="Mark no-show"
                        pendingLabel="Updating…"
                        onSuccess={closeDialog}
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className="border-t border-line pt-4">
                  <h3 className="text-sm font-semibold text-ink">Reschedule</h3>
                  <div className="mt-2">
                    <RescheduleForm
                      appointmentId={appointmentId}
                      scheduleHint={scheduleHint}
                      onSuccess={closeDialog}
                    />
                  </div>
                </div>

                {canCancel ? (
                  <div className="border-t border-line pt-4">
                    <h3 className="text-sm font-semibold text-ink">
                      Cancel appointment
                    </h3>
                    <div className="mt-2">
                      <CancelForm
                        appointmentId={appointmentId}
                        patientName={patientName}
                        onSuccess={closeDialog}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-ink">History</h3>
              <div className="mt-2">
                <HistoryTimeline history={history} />
              </div>
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
