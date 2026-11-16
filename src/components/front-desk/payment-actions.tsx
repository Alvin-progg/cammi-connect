"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Dialog } from "@base-ui/react/dialog";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";

import { DIALOG_BACKDROP_CLASS, DIALOG_POPUP_CLASS } from "./dialog-styles";
import { ReasonFields } from "./reason-fields";

import { Button, buttonVariants } from "@/components/ui/button";
import { CONTROL_CLASS } from "@/components/ui/field";
import {
  RECEIPT_REJECTION_REASONS,
  RECEIPT_REJECTION_REASON_LABELS,
} from "@/lib/billing/verification";
import type { RequestDecisionState } from "@/server/front-desk/actions";
import {
  decideHmoAction,
  markRefundedAction,
  rejectReceiptAction,
  verifyPaymentAction,
  viewReceiptAction,
} from "@/server/payments/actions";

const IDLE_STATE: RequestDecisionState = { status: "idle" };

type PaymentRef = { paymentId: string; appointmentId: string };

type FormProps = PaymentRef & { close: () => void; safeActionRef: RefObject<HTMLButtonElement | null> };

/**
 * A payment decision in a dialog, like the request decisions. Rejecting is
 * destructive, so it uses an alert dialog a backdrop click cannot dismiss.
 */
function PaymentDialog({
  payment,
  title,
  description,
  triggerLabel,
  destructive = false,
  Form,
}: {
  payment: PaymentRef;
  title: string;
  description: string;
  triggerLabel: string;
  destructive?: boolean;
  Form: (props: FormProps) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const safeActionRef = useRef<HTMLButtonElement>(null);
  const Parts = destructive ? AlertDialog : Dialog;

  return (
    <Parts.Root open={open} onOpenChange={setOpen}>
      <Parts.Trigger
        className={buttonVariants({
          variant: destructive ? "outlineDanger" : "primary",
          size: "lg",
          className: "w-full",
        })}
      >
        {triggerLabel}
      </Parts.Trigger>
      <Parts.Portal>
        <Parts.Backdrop className={DIALOG_BACKDROP_CLASS} />
        <Parts.Popup initialFocus={safeActionRef} className={DIALOG_POPUP_CLASS}>
          <Parts.Title className="text-lg font-semibold text-ink">{title}</Parts.Title>
          <Parts.Description className="mt-2 text-sm text-ink-secondary">{description}</Parts.Description>
          <Form {...payment} close={close} safeActionRef={safeActionRef} />
        </Parts.Popup>
      </Parts.Portal>
    </Parts.Root>
  );
}

function useSuccess(state: RequestDecisionState, close: () => void) {
  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      close();
    }
  }, [state, close]);
}

function FormFooter({
  state,
  pending,
  submitLabel,
  pendingLabel,
  danger = false,
  close,
  safeActionRef,
}: {
  state: RequestDecisionState;
  pending: boolean;
  submitLabel: string;
  pendingLabel: string;
  danger?: boolean;
  close: () => void;
  safeActionRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <>
      {state.status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button ref={safeActionRef} variant="ghost" onClick={close}>
          Go back
        </Button>
        <Button type="submit" variant={danger ? "danger" : "primary"} disabled={pending} aria-busy={pending || undefined}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </>
  );
}

function Hidden({ paymentId, appointmentId }: PaymentRef) {
  return (
    <>
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="appointmentId" value={appointmentId} />
    </>
  );
}

function TextField({ id, label, ...props }: { id: string; label: string } & ComponentProps<"input">) {
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input id={id} required className={CONTROL_CLASS} {...props} />
    </div>
  );
}

function VerifyForm({ close, safeActionRef, ...payment }: FormProps) {
  const [state, formAction, pending] = useActionState(verifyPaymentAction, IDLE_STATE);
  useSuccess(state, close);
  const prefix = `verify-${payment.paymentId}`;

  return (
    <form action={formAction}>
      <Hidden {...payment} />
      <TextField id={`${prefix}-reference`} name="transactionReference" label="Transaction reference" maxLength={100} autoComplete="off" />
      <TextField id={`${prefix}-amount`} name="amountReceived" label="Amount received (₱)" inputMode="decimal" />
      <TextField id={`${prefix}-time`} name="receivedAt" label="Time received" type="datetime-local" />
      <p className="mt-3 text-xs text-ink-muted">
        A reference can verify only one payment, and the amount must cover the amount due.
      </p>
      <FormFooter
        state={state}
        pending={pending}
        submitLabel="Verify payment"
        pendingLabel="Verifying…"
        close={close}
        safeActionRef={safeActionRef}
      />
    </form>
  );
}

function RejectForm({ close, safeActionRef, ...payment }: FormProps) {
  const [state, formAction, pending] = useActionState(rejectReceiptAction, IDLE_STATE);
  useSuccess(state, close);

  return (
    <form action={formAction}>
      <Hidden {...payment} />
      <ReasonFields
        idPrefix={`reject-receipt-${payment.paymentId}`}
        reasons={RECEIPT_REJECTION_REASONS}
        labels={RECEIPT_REJECTION_REASON_LABELS}
        note="Cami tells the patient the reason, and they can send another receipt."
      />
      <FormFooter
        state={state}
        pending={pending}
        submitLabel="Reject receipt"
        pendingLabel="Rejecting…"
        danger
        close={close}
        safeActionRef={safeActionRef}
      />
    </form>
  );
}

function RefundForm({ close, safeActionRef, ...payment }: FormProps) {
  const [state, formAction, pending] = useActionState(markRefundedAction, IDLE_STATE);
  useSuccess(state, close);

  return (
    <form action={formAction}>
      <Hidden {...payment} />
      <TextField
        id={`refund-${payment.paymentId}-reference`}
        name="refundReference"
        label="Refund reference"
        maxLength={100}
        autoComplete="off"
      />
      <FormFooter
        state={state}
        pending={pending}
        submitLabel="Mark refunded"
        pendingLabel="Saving…"
        close={close}
        safeActionRef={safeActionRef}
      />
    </form>
  );
}

function ApproveHmoForm({ close, safeActionRef, ...payment }: FormProps) {
  const [state, formAction, pending] = useActionState(decideHmoAction, IDLE_STATE);
  useSuccess(state, close);

  return (
    <form action={formAction}>
      <Hidden {...payment} />
      <input type="hidden" name="decision" value="approve" />
      <TextField
        id={`hmo-approve-${payment.paymentId}-loa`}
        name="loaNumber"
        label="LOA number"
        maxLength={100}
        autoComplete="off"
      />
      <FormFooter
        state={state}
        pending={pending}
        submitLabel="Approve coverage"
        pendingLabel="Approving…"
        close={close}
        safeActionRef={safeActionRef}
      />
    </form>
  );
}

function DenyHmoForm({ close, safeActionRef, ...payment }: FormProps) {
  const [state, formAction, pending] = useActionState(decideHmoAction, IDLE_STATE);
  useSuccess(state, close);
  const id = `hmo-deny-${payment.paymentId}-reason`;

  return (
    <form action={formAction}>
      <Hidden {...payment} />
      <input type="hidden" name="decision" value="deny" />
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          Reason
        </label>
        <textarea id={id} name="reason" required maxLength={500} rows={3} className={CONTROL_CLASS} />
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        The reason stays with the front desk. Cami tells the patient the new amount and sends the QR.
      </p>
      <FormFooter
        state={state}
        pending={pending}
        submitLabel="Deny coverage"
        pendingLabel="Denying…"
        danger
        close={close}
        safeActionRef={safeActionRef}
      />
    </form>
  );
}

export function ApproveHmoDialog(payment: PaymentRef) {
  return (
    <PaymentDialog
      payment={payment}
      title="Approve HMO coverage?"
      description="Check the LOA or eligibility with the HMO first. The patient pays only the co-pay, if any."
      triggerLabel="Approve coverage"
      Form={ApproveHmoForm}
    />
  );
}

export function DenyHmoDialog(payment: PaymentRef) {
  return (
    <PaymentDialog
      payment={payment}
      title="Deny HMO coverage?"
      description="The visit becomes self-pay at the regular price, with a new payment deadline."
      triggerLabel="Deny coverage"
      destructive
      Form={DenyHmoForm}
    />
  );
}

export function VerifyPaymentDialog(payment: PaymentRef) {
  return (
    <PaymentDialog
      payment={payment}
      title="Verify this payment?"
      description="Find the transaction in the hospital's GCash, Maya, or bank account first. A receipt photo alone proves nothing."
      triggerLabel="Verify payment"
      Form={VerifyForm}
    />
  );
}

export function RejectReceiptDialog(payment: PaymentRef) {
  return (
    <PaymentDialog
      payment={payment}
      title="Reject this receipt?"
      description="The request stays pending until the patient pays or the deadline passes."
      triggerLabel="Reject receipt"
      destructive
      Form={RejectForm}
    />
  );
}

export function MarkRefundedDialog(payment: PaymentRef) {
  return (
    <PaymentDialog
      payment={payment}
      title="Mark this payment refunded?"
      description="Enter the reference of the refund you sent. Cami tells the patient."
      triggerLabel="Mark refunded"
      Form={RefundForm}
    />
  );
}

/**
 * Shows the latest receipt. The server audits the view and makes a
 * 60-second signed link; the image is fetched right away and shown from
 * memory (the CSP allows only same-site, data:, and blob: images).
 */
export function ReceiptViewer({ paymentId }: { paymentId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  async function open() {
    setError(null);
    setLoading(true);
    try {
      const result = await viewReceiptAction(paymentId);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      const response = await fetch(result.url);
      if (!response.ok) throw new Error("receipt fetch failed");
      setSrc(URL.createObjectURL(await response.blob()));
    } catch {
      setError("The receipt could not be opened. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="lg" className="w-full" onClick={open} disabled={loading} aria-busy={loading || undefined}>
        {loading ? "Opening…" : "View receipt"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {error}
        </p>
      ) : null}
      <Dialog.Root open={src !== null} onOpenChange={(next) => (next ? null : setSrc(null))}>
        <Dialog.Portal>
          <Dialog.Backdrop className={DIALOG_BACKDROP_CLASS} />
          <Dialog.Popup className={`${DIALOG_POPUP_CLASS} max-w-lg`}>
            <Dialog.Title className="text-lg font-semibold text-ink">Payment receipt</Dialog.Title>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element -- a blob: URL; next/image cannot load it.
              <img src={src} alt="Receipt sent by the patient" className="mt-4 w-full rounded-lg border border-line" />
            ) : null}
            <div className="mt-5 flex justify-end">
              <Dialog.Close className={buttonVariants({ variant: "ghost" })}>Close</Dialog.Close>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
