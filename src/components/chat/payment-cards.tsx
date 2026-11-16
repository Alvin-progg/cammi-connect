"use client";

import Image from "next/image";
import { createContext, useContext, useId, useState } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CONTROL_CLASS } from "@/components/ui/field";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { privilegeChoiceSchema } from "@/lib/billing/compute";
import { formatPesos } from "@/lib/billing/money";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/billing/payments";
import { RECEIPT_ACCEPT } from "@/lib/billing/receipts";
import { PAYMENT_COPY, PRIVILEGE_LABELS, paymentChoiceLabel } from "@/lib/chat/payment";
import type {
  BookedPayment,
  ChargeSummary,
  ChatMessage,
  ChatMessagePayload,
} from "@/lib/chat/schemas";
import { HMO_MEMBER_NUMBER_MAX_LENGTH, type PaymentChoice } from "@/lib/chat/state";

import { RequirementList, type CardProps } from "./booking-cards";

/**
 * PAY-03 cards: the discount and payer questions, the summary breakdown, and
 * the payment details after booking. Every amount comes from the server
 * payload, which is computed from database prices.
 */

export function PrivilegeOptions({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<ChatMessagePayload, { kind: "privilege_options" }> }) {
  return (
    <>
      {payload.requirements?.length ? <RequirementList requirements={payload.requirements} /> : null}
      <PrivilegeButtons interactive={interactive} busy={busy} onEvent={onEvent} />
    </>
  );
}

function PrivilegeButtons({ interactive, busy, onEvent }: CardProps) {
  return (
    <ul aria-label="Discounts" className="mt-3 flex flex-wrap gap-2">
      {privilegeChoiceSchema.options.map((privilege) => (
        <li key={privilege}>
          <button
            type="button"
            disabled={!interactive || busy}
            onClick={() => onEvent({ type: "select_privilege", privilege })}
            className={buttonVariants({ variant: "secondary" })}
          >
            {PRIVILEGE_LABELS[privilege]}
          </button>
        </li>
      ))}
    </ul>
  );
}

const SELF_PAY_CHOICES: PaymentChoice[] = [
  { payer: "self", method: "qr_ph" },
  { payer: "self", method: "counter" },
];

export function PayerOptions({
  payload,
  interactive,
  busy,
  onEvent,
}: CardProps & { payload: Extract<ChatMessagePayload, { kind: "payer_options" }> }) {
  const [hmoOpen, setHmoOpen] = useState(false);
  const [hmoProviderId, setHmoProviderId] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const id = useId();
  const disabled = !interactive || busy;
  const choices: PaymentChoice[] = payload.philhealth
    ? [...SELF_PAY_CHOICES, { payer: "philhealth" }]
    : SELF_PAY_CHOICES;

  return (
    <div className="mt-3 space-y-3">
      <ul aria-label="Payment options" className="flex flex-wrap gap-2">
        {choices.map((payment) => (
          <li key={paymentChoiceLabel(payment)}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onEvent({ type: "select_payer", payment })}
              className={buttonVariants({ variant: "secondary" })}
            >
              {paymentChoiceLabel(payment)}
            </button>
          </li>
        ))}
        {payload.hmoProviders.length > 0 ? (
          <li>
            <button
              type="button"
              disabled={disabled}
              aria-expanded={hmoOpen}
              onClick={() => setHmoOpen(true)}
              className={buttonVariants({ variant: "secondary" })}
            >
              My HMO
            </button>
          </li>
        ) : null}
      </ul>
      {hmoOpen ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = memberNumber.trim();
            if (!hmoProviderId || !trimmed) return;
            onEvent({
              type: "select_payer",
              payment: { payer: "hmo", hmoProviderId, memberNumber: trimmed },
            });
          }}
        >
          <label htmlFor={`${id}-hmo`} className="text-sm font-medium text-ink">
            HMO
          </label>
          <select
            id={`${id}-hmo`}
            value={hmoProviderId}
            onChange={(event) => setHmoProviderId(event.target.value)}
            className={`${CONTROL_CLASS} h-11`}
          >
            <option value="">Choose your HMO</option>
            {payload.hmoProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <label htmlFor={`${id}-member`} className="text-sm font-medium text-ink">
            Member number
          </label>
          <input
            id={`${id}-member`}
            value={memberNumber}
            maxLength={HMO_MEMBER_NUMBER_MAX_LENGTH}
            autoComplete="off"
            onChange={(event) => setMemberNumber(event.target.value)}
            className={`${CONTROL_CLASS} h-11`}
          />
          <div>
            <button
              type="submit"
              disabled={disabled || !hmoProviderId || !memberNumber.trim()}
              className={buttonVariants({ variant: "primary" })}
            >
              Use my HMO
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function BreakdownRow({ term, amount, strong = false }: { term: string; amount: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold text-ink" : "text-ink-secondary"}`}>
      <dt>{term}</dt>
      <dd className="tabular-nums">{amount}</dd>
    </div>
  );
}

const minus = (centavos: number) => `−${formatPesos(centavos)}`;

/** Price → VAT exemption → 20% → PhilHealth → HMO → amount to pay; zero deductions are left out. */
export function ChargeBreakdown({ charge }: { charge: ChargeSummary }) {
  return (
    <div role="group" aria-label="Price breakdown" className="mt-3 border-t border-line pt-2">
      <p className="text-xs text-ink-muted">
        {PRIVILEGE_LABELS[charge.privilege]} · {charge.payerLabel}
      </p>
      <dl className="mt-1.5 space-y-1 text-sm">
        <BreakdownRow term="Price" amount={formatPesos(charge.baseCentavos)} />
        {charge.vatExemptionCentavos > 0 ? (
          <BreakdownRow term="VAT exemption" amount={minus(charge.vatExemptionCentavos)} />
        ) : null}
        {charge.privilegeDiscountCentavos > 0 ? (
          <BreakdownRow term="20% discount" amount={minus(charge.privilegeDiscountCentavos)} />
        ) : null}
        {charge.philhealthCentavos > 0 ? (
          <BreakdownRow term="PhilHealth" amount={minus(charge.philhealthCentavos)} />
        ) : null}
        {charge.hmoCentavos > 0 ? (
          <BreakdownRow term="HMO" amount={minus(charge.hmoCentavos)} />
        ) : null}
        <BreakdownRow term="Amount to pay" amount={formatPesos(charge.amountDueCentavos)} strong />
      </dl>
    </div>
  );
}

export type PaymentQr = {
  /** payment.qr_image_path when it is a same-site path; null when not configured. */
  imageSrc: string | null;
  accountName: string;
};

/**
 * What payment cards need from the page: the QR settings (null while
 * payment.enabled is off), the open chat, and where Cami's reply goes.
 */
export const PaymentCardContext = createContext<{
  qr: PaymentQr | null;
  conversationId: string | null;
  onReceiptMessage?: (message: ChatMessage) => void;
}>({ qr: null, conversationId: null });

const RECEIPT_STATUSES: readonly PaymentStatus[] = ["awaiting_payment", "rejected"];

/** Reads the server's fixed error copy; it never contains receipt content. */
async function receiptErrorMessage(response: Response): Promise<string> {
  try {
    const body: { error?: { message?: unknown } } = await response.json();
    if (typeof body.error?.message === "string") return body.error.message;
  } catch {}
  return RECEIPT_FALLBACK_ERROR;
}

const RECEIPT_FALLBACK_ERROR = "Your receipt couldn't be sent right now. Please try again in a moment.";

/**
 * PAY-04: the photo goes only to the receipt route, which checks it and
 * stores it privately; it is never sent to the chat or the assistant.
 */
function ReceiptUpload({ paymentId, onSent }: { paymentId: string; onSent: () => void }) {
  const { conversationId, onReceiptMessage } = useContext(PaymentCardContext);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const id = useId();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.set("receipt", file);
    if (conversationId) body.set("conversationId", conversationId);
    setSending(true);
    try {
      const response = await fetch(`/api/v1/payments/${paymentId}/receipt`, { method: "POST", body });
      if (!response.ok) {
        toast.error("Receipt not sent", {
          id: "receipt-upload-error",
          description: await receiptErrorMessage(response),
        });
        return;
      }
      const result: { message: ChatMessage | null } = await response.json();
      onSent();
      if (result.message) onReceiptMessage?.(result.message);
    } catch {
      toast.error("Receipt not sent", { id: "receipt-upload-error", description: RECEIPT_FALLBACK_ERROR });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
      <label htmlFor={`${id}-receipt`} className="text-sm font-medium text-ink">
        Photo of your receipt
      </label>
      <input
        id={`${id}-receipt`}
        name="receipt"
        type="file"
        accept={RECEIPT_ACCEPT}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        aria-describedby={`${id}-hint`}
        className="text-sm text-ink-secondary file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink"
      />
      <p id={`${id}-hint`} className="text-xs text-ink-muted">
        JPEG, PNG, or WebP, up to 5 MB.
      </p>
      <div>
        <button
          type="submit"
          disabled={sending || !file}
          className={buttonVariants({ variant: "primary" })}
        >
          {sending ? "Sending…" : "Send receipt"}
        </button>
      </div>
    </form>
  );
}

/**
 * The payment after booking, and in My appointments for paying later
 * (PAY-04): status, amount, reference code, deadline, and for a QR payer the
 * hospital's QR Ph with a receipt upload.
 */
export function BookedPaymentDetails({ payment }: { payment: BookedPayment }) {
  const { qr } = useContext(PaymentCardContext);
  // The server moved it to submitted; the card follows without a reload.
  const [status, setStatus] = useState(payment.status);
  const showQr = qr !== null && RECEIPT_STATUSES.includes(status) && payment.method !== "counter";

  return (
    <div role="group" aria-label="Payment" className="mt-2 border-t border-line pt-2">
      <Badge tone={RECEIPT_STATUSES.includes(status) ? "warning" : "neutral"}>
        {PAYMENT_STATUS_LABELS[status]}
      </Badge>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Amount to pay</dt>
          <dd className="tabular-nums text-ink">{formatPesos(payment.amountDueCentavos)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">Reference code</dt>
          <dd className="font-mono text-ink">{payment.referenceCode}</dd>
        </div>
        {payment.deadline ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Pay by</dt>
            <dd className="text-ink">{formatManilaDateTime(payment.deadline)}</dd>
          </div>
        ) : null}
        {showQr && qr.imageSrc && qr.accountName ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Account name</dt>
            <dd className="text-ink">{qr.accountName}</dd>
          </div>
        ) : null}
      </dl>
      {showQr && qr.imageSrc ? (
        <>
          <Image
            src={qr.imageSrc}
            alt={`QR Ph code for ${qr.accountName || "the hospital"}`}
            width={192}
            height={192}
            unoptimized
            className="mt-3 rounded-md border border-line bg-white p-2"
          />
          {payment.id ? (
            <ReceiptUpload paymentId={payment.id} onSent={() => setStatus("submitted")} />
          ) : null}
        </>
      ) : showQr ? (
        <p className="mt-2 text-sm text-ink-secondary">{PAYMENT_COPY.qrNotConfigured}</p>
      ) : null}
    </div>
  );
}
