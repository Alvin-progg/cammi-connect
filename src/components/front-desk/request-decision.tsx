"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from "react";
import { toast } from "sonner";

import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from "./dialog-styles";
import { ReasonFields } from "./reason-fields";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  CANCELLATION_REASONS,
  CANCELLATION_REASON_LABELS,
  REJECTION_REASONS,
  REJECTION_REASON_LABELS,
} from "@/lib/front-desk/decisions";
import {
  cancelAppointmentAction,
  confirmRequestAction,
  rejectRequestAction,
  type RequestDecisionState,
} from "@/server/front-desk/actions";

const IDLE_STATE: RequestDecisionState = { status: "idle" };

type Summary = {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  whenLabel: string;
};

type DecisionFormProps = {
  summary: Summary;
  close: () => void;
  /** The "Go back" button, which takes initial focus (design.md §5.8). */
  safeActionRef: RefObject<HTMLButtonElement | null>;
};

/**
 * A modal decision dialog. Confirming uses a regular dialog; rejecting and
 * cancelling are destructive, so they use an alert dialog that a backdrop
 * click cannot dismiss. The popup unmounts when closed, so each opening
 * starts from a fresh form state.
 */
function DecisionDialog({
  summary,
  destructive,
  title,
  triggerLabel,
  triggerVariant,
  Form,
}: {
  summary: Summary;
  destructive: boolean;
  title: string;
  triggerLabel: string;
  triggerVariant: "primary" | "outlineDanger";
  Form: ComponentType<DecisionFormProps>;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const safeActionRef = useRef<HTMLButtonElement>(null);
  const Parts = destructive ? AlertDialog : Dialog;

  return (
    <Parts.Root open={open} onOpenChange={setOpen}>
      <Parts.Trigger className={buttonVariants({ variant: triggerVariant })}>
        {triggerLabel}
      </Parts.Trigger>
      <Parts.Portal>
        <Parts.Backdrop className={DIALOG_BACKDROP_CLASS} />
        <Parts.Popup initialFocus={safeActionRef} className={DIALOG_POPUP_CLASS}>
          <Parts.Title className="text-lg font-semibold text-ink">{title}</Parts.Title>
          <Parts.Description render={<div />} className="mt-2 text-sm">
            <p className="font-medium text-ink">{summary.patientName}</p>
            <p className="text-ink-secondary">{`${summary.doctorName} · ${summary.whenLabel}`}</p>
          </Parts.Description>
          <Form summary={summary} close={close} safeActionRef={safeActionRef} />
        </Parts.Popup>
      </Parts.Portal>
    </Parts.Root>
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

function ConfirmForm({ summary, close, safeActionRef }: DecisionFormProps) {
  const [state, formAction, pending] = useActionState(confirmRequestAction, IDLE_STATE);
  useSuccess(state, close);

  return (
    <form action={formAction}>
      <input type="hidden" name="appointmentId" value={summary.appointmentId} />
      <p className="mt-3 text-sm text-ink-muted">
        The doctor&apos;s schedule is checked again when you confirm.
      </p>
      <ErrorMessage state={state} />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button ref={safeActionRef} variant="ghost" onClick={close}>
          Go back
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Confirming…" : "Confirm appointment"}
        </Button>
      </div>
    </form>
  );
}

function RejectForm({ summary, close, safeActionRef }: DecisionFormProps) {
  const [state, formAction, pending] = useActionState(rejectRequestAction, IDLE_STATE);
  useSuccess(state, close);

  return (
    <form action={formAction}>
      <input type="hidden" name="appointmentId" value={summary.appointmentId} />
      <ReasonFields
        idPrefix={`reject-${summary.appointmentId}`}
        reasons={REJECTION_REASONS}
        labels={REJECTION_REASON_LABELS}
        note="The request stays on record with this reason."
      />
      <ErrorMessage state={state} />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button ref={safeActionRef} variant="ghost" onClick={close}>
          Go back
        </Button>
        <Button
          type="submit"
          variant="danger"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Rejecting…" : "Reject request"}
        </Button>
      </div>
    </form>
  );
}

function CancelForm({ summary, close, safeActionRef }: DecisionFormProps) {
  const [state, formAction, pending] = useActionState(cancelAppointmentAction, IDLE_STATE);
  useSuccess(state, close);

  return (
    <form action={formAction}>
      <input type="hidden" name="appointmentId" value={summary.appointmentId} />
      <ReasonFields
        idPrefix={`cancel-${summary.appointmentId}`}
        reasons={CANCELLATION_REASONS}
        labels={CANCELLATION_REASON_LABELS}
        note="The appointment stays on record with this reason, and the slot is freed."
      />
      <ErrorMessage state={state} />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button ref={safeActionRef} variant="ghost" onClick={close}>
          Go back
        </Button>
        <Button
          type="submit"
          variant="danger"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? "Cancelling…" : "Cancel appointment"}
        </Button>
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
        destructive={false}
        title="Confirm this appointment?"
        triggerLabel="Confirm request"
        triggerVariant="primary"
        Form={ConfirmForm}
      />
      <DecisionDialog
        summary={summary}
        destructive
        title="Reject this request?"
        triggerLabel="Reject request"
        triggerVariant="outlineDanger"
        Form={RejectForm}
      />
    </div>
  );
}

/**
 * Cancel control for a pending or confirmed appointment (SPEC-frontdesk §9).
 * A reason is required; the server re-checks the staff role and the status,
 * and success is shown only after it commits.
 */
export function CancelAppointment(summary: Summary) {
  return (
    <DecisionDialog
      summary={summary}
      destructive
      title="Cancel this appointment?"
      triggerLabel="Cancel appointment"
      triggerVariant="outlineDanger"
      Form={CancelForm}
    />
  );
}
