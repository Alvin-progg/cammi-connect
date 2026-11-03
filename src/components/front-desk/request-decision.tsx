"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { toast } from "sonner";

import {
  REJECTION_REASONS,
  REJECTION_REASON_LABELS,
  type RejectionReason,
} from "@/lib/front-desk/decisions";
import {
  confirmRequestAction,
  rejectRequestAction,
  type RequestDecisionState,
} from "@/server/front-desk/actions";

const IDLE_STATE: RequestDecisionState = { status: "idle" };

const BUTTON_BASE =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none";
const PRIMARY_BUTTON = `${BUTTON_BASE} border-primary bg-primary text-primary-ink hover:bg-primary-hover`;
const DANGER_BUTTON = `${BUTTON_BASE} border-danger bg-danger text-danger-ink hover:bg-danger-hover`;
const OUTLINE_DANGER_BUTTON = `${BUTTON_BASE} border-line-strong bg-surface text-danger hover:bg-danger-soft`;
const QUIET_BUTTON = `${BUTTON_BASE} border-transparent bg-transparent text-ink hover:bg-surface-muted`;

type Summary = {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  whenLabel: string;
};

/**
 * A native modal dialog that mounts its form only while open, so each
 * opening starts from a fresh form state.
 */
function DecisionDialog({
  summary,
  kind,
  title,
  triggerLabel,
  triggerClassName,
  Form,
}: {
  summary: Summary;
  kind: "confirm" | "reject";
  title: string;
  triggerLabel: string;
  triggerClassName: string;
  Form: ComponentType<{ summary: Summary; close: () => void }>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => dialogRef.current?.close(), []);
  const titleId = `${kind}-title-${summary.appointmentId}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          dialogRef.current?.showModal();
        }}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="dialog-motion m-auto w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-overlay backdrop:bg-overlay"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        {isOpen ? (
          <>
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            <Form summary={summary} close={close} />
          </>
        ) : null}
      </dialog>
    </>
  );
}

function ErrorMessage({ state }: { state: RequestDecisionState }) {
  return state.status === "error" ? (
    <p role="alert" className="mt-3 text-sm text-danger-soft-ink">
      {state.message}
    </p>
  ) : null;
}

/** Closes the dialog and announces success once the action has committed. */
function useSuccess(state: RequestDecisionState, close: () => void) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      close();
    }
  }, [state, close]);
}

function SummaryLines({ summary }: { summary: Summary }) {
  return (
    <div className="mt-2 text-sm">
      <p className="font-medium text-ink">{summary.patientName}</p>
      <p className="text-ink-secondary">{`${summary.doctorName} · ${summary.whenLabel}`}</p>
    </div>
  );
}

function ConfirmForm({ summary, close }: { summary: Summary; close: () => void }) {
  const [state, formAction, pending] = useActionState(confirmRequestAction, IDLE_STATE);
  useSuccess(state, close);

  return (
    <form action={formAction}>
      <input type="hidden" name="appointmentId" value={summary.appointmentId} />
      <SummaryLines summary={summary} />
      <p className="mt-3 text-sm text-ink-muted">
        The doctor&apos;s schedule is checked again when you confirm.
      </p>
      <ErrorMessage state={state} />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={close} className={QUIET_BUTTON}>
          Go back
        </button>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={PRIMARY_BUTTON}
        >
          {pending ? "Confirming…" : "Confirm appointment"}
        </button>
      </div>
    </form>
  );
}

function RejectForm({ summary, close }: { summary: Summary; close: () => void }) {
  const [state, formAction, pending] = useActionState(rejectRequestAction, IDLE_STATE);
  const [reason, setReason] = useState<RejectionReason | null>(null);
  useSuccess(state, close);

  const detailsId = `reject-details-${summary.appointmentId}`;
  const reasonLabelId = `reject-reason-${summary.appointmentId}`;

  return (
    <form action={formAction}>
      <input type="hidden" name="appointmentId" value={summary.appointmentId} />
      <SummaryLines summary={summary} />
      <fieldset className="mt-4">
        <legend id={reasonLabelId} className="text-sm font-medium text-ink">
          Reason
        </legend>
        <div role="radiogroup" aria-labelledby={reasonLabelId} className="mt-2 flex flex-col gap-1">
          {REJECTION_REASONS.map((value) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-ink hover:bg-surface-muted"
            >
              <input
                type="radio"
                name="reason"
                value={value}
                required
                checked={reason === value}
                onChange={() => setReason(value)}
                className="size-4 accent-primary"
              />
              {REJECTION_REASON_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={detailsId} className="mt-4 block text-sm font-medium text-ink">
        {reason === "other" ? "Details (required)" : "Details (optional)"}
      </label>
      <textarea
        id={detailsId}
        name="details"
        rows={3}
        maxLength={500}
        required={reason === "other"}
        className="mt-1 w-full rounded-lg border border-control-line bg-surface px-3 py-2 text-base text-ink focus-ring"
      />
      <p className="mt-2 text-sm text-ink-muted">
        The request stays on record with this reason.
      </p>
      <ErrorMessage state={state} />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={close} className={QUIET_BUTTON}>
          Go back
        </button>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
          className={DANGER_BUTTON}
        >
          {pending ? "Rejecting…" : "Reject request"}
        </button>
      </div>
    </form>
  );
}

/**
 * Confirm and reject controls for one pending request (SPEC-frontdesk §6).
 * Each decision goes through a dialog; the server re-checks the staff role
 * and the pending status, and success is shown only after it commits.
 */
export function RequestDecision(summary: Summary) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionDialog
        summary={summary}
        kind="confirm"
        title="Confirm this appointment?"
        triggerLabel="Confirm request"
        triggerClassName={PRIMARY_BUTTON}
        Form={ConfirmForm}
      />
      <DecisionDialog
        summary={summary}
        kind="reject"
        title="Reject this request?"
        triggerLabel="Reject request"
        triggerClassName={OUTLINE_DANGER_BUTTON}
        Form={RejectForm}
      />
    </div>
  );
}
