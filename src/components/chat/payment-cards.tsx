"use client";

import { useId, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CONTROL_CLASS } from "@/components/ui/field";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { privilegeChoiceSchema } from "@/lib/billing/compute";
import { formatPesos } from "@/lib/billing/money";
import { PAYMENT_STATUS_LABELS } from "@/lib/billing/payments";
import { PRIVILEGE_LABELS, paymentChoiceLabel } from "@/lib/chat/payment";
import type { BookedPayment, ChargeSummary, ChatMessagePayload } from "@/lib/chat/schemas";
import { HMO_MEMBER_NUMBER_MAX_LENGTH, type PaymentChoice } from "@/lib/chat/state";

import type { CardProps } from "./booking-cards";

/**
 * PAY-03 cards: the discount and payer questions, the summary breakdown, and
 * the payment details after booking. Every amount comes from the server
 * payload, which is computed from database prices.
 */

export function PrivilegeOptions({ interactive, busy, onEvent }: CardProps) {
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

/** After booking with a charge. The QR card comes with PAY-04. */
export function BookedPaymentDetails({ payment }: { payment: BookedPayment }) {
  return (
    <div className="mt-2 border-t border-line pt-2">
      <Badge tone={payment.status === "awaiting_payment" ? "warning" : "neutral"}>
        {PAYMENT_STATUS_LABELS[payment.status]}
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
      </dl>
    </div>
  );
}
