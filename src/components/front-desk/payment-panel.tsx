import type { ReactNode } from "react";

import { formatManilaDateTime } from "@/lib/appointments/format";
import { formatPesos } from "@/lib/billing/money";
import type { FrontDeskHmo } from "@/lib/billing/hmo";
import type { FrontDeskPayment } from "@/lib/billing/verification";

import {
  ApproveHmoDialog,
  DenyHmoDialog,
  MarkRefundedDialog,
  ReceiptViewer,
  RejectReceiptDialog,
  VerifyPaymentDialog,
} from "./payment-actions";
import { PaymentBadge } from "./payment-badge";

const DETAIL_LIST = "grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words tabular-nums text-ink">{children}</dd>
    </div>
  );
}

const PAYER_LABELS: Record<FrontDeskPayment["payer"], string> = {
  self: "Patient",
  hmo: "HMO",
  philhealth: "PhilHealth",
};

const METHOD_LABELS: Record<NonNullable<FrontDeskPayment["method"]>, string> = {
  qr_ph: "QR Ph (GCash, Maya, bank)",
  counter: "At the hospital cashier",
};

/**
 * PAY-05 Payment panel on request details: the charge breakdown, reference
 * code, deadline, attempts, and the front desk's payment actions. Front desk
 * only; the doctor dashboard never shows payments.
 */
export function PaymentPanel({
  appointmentId,
  payment,
  now,
  decidable = true,
}: {
  appointmentId: string;
  payment: FrontDeskPayment;
  now: Date;
  /** False once the request is no longer pending; verify and reject need a pending request. */
  decidable?: boolean;
}) {
  const ref = { paymentId: payment.id, appointmentId };
  const canVerify =
    decidable && (payment.status === "awaiting_payment" || payment.status === "submitted" || payment.status === "rejected");
  const canReject = decidable && payment.status === "submitted";
  const discountLabel = payment.privilege === "pwd" ? "20% PWD discount" : "20% senior discount";

  return (
    <section
      aria-labelledby="payment-heading"
      className="min-w-0 rounded-xl border border-line bg-surface p-6 shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="payment-heading" className="text-lg font-semibold leading-7 text-ink">
          Payment
        </h2>
        <PaymentBadge payment={payment} now={now} />
      </div>
      <dl className={`mt-4 ${DETAIL_LIST}`}>
        <Row label="Reference code">
          <span className="font-mono">{payment.referenceCode}</span>
        </Row>
        <Row label="Paid by">
          {payment.method ? `${PAYER_LABELS[payment.payer]} · ${METHOD_LABELS[payment.method]}` : PAYER_LABELS[payment.payer]}
        </Row>
        <Row label="Price">{formatPesos(payment.baseCentavos)}</Row>
        {payment.vatExemptionCentavos > 0 ? (
          <Row label="VAT exemption">{`−${formatPesos(payment.vatExemptionCentavos)}`}</Row>
        ) : null}
        {payment.privilegeDiscountCentavos > 0 ? (
          <Row label={discountLabel}>{`−${formatPesos(payment.privilegeDiscountCentavos)}`}</Row>
        ) : null}
        {payment.philhealthCentavos > 0 ? (
          <Row label="PhilHealth">{`−${formatPesos(payment.philhealthCentavos)}`}</Row>
        ) : null}
        {payment.hmoCentavos > 0 ? <Row label="HMO">{`−${formatPesos(payment.hmoCentavos)}`}</Row> : null}
        <Row label="Amount to pay">
          <span className="font-semibold">{formatPesos(payment.amountDueCentavos)}</span>
        </Row>
        {payment.deadline ? <Row label="Deadline">{formatManilaDateTime(payment.deadline)}</Row> : null}
        <Row label="Receipts sent">{String(payment.attempts)}</Row>
        {payment.transactionReference ? (
          <Row label="Transaction ref.">
            <span className="font-mono">{payment.transactionReference}</span>
          </Row>
        ) : null}
        {payment.amountReceivedCentavos !== null ? (
          <Row label="Amount received">{formatPesos(payment.amountReceivedCentavos)}</Row>
        ) : null}
        {payment.receivedAt ? <Row label="Received">{formatManilaDateTime(payment.receivedAt)}</Row> : null}
        {payment.rejectedReason ? <Row label="Receipt rejected">{payment.rejectedReason}</Row> : null}
        {payment.refundReference ? (
          <Row label="Refund reference">
            <span className="font-mono">{payment.refundReference}</span>
          </Row>
        ) : null}
      </dl>
      {payment.hmo ? (
        <HmoCoverage
          hmo={payment.hmo}
          copayCentavos={payment.payer === "hmo" ? payment.amountDueCentavos : null}
          decision={decidable && payment.status === "hmo_pending" ? ref : null}
        />
      ) : null}
      {payment.hasReceipt || canVerify || canReject || payment.status === "refund_due" ? (
        <div className="mt-5 flex flex-col gap-2">
          {payment.hasReceipt ? <ReceiptViewer paymentId={payment.id} /> : null}
          {canVerify ? <VerifyPaymentDialog {...ref} /> : null}
          {canReject ? <RejectReceiptDialog {...ref} /> : null}
          {payment.status === "refund_due" ? <MarkRefundedDialog {...ref} /> : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * PAY-06 HMO section. The member number is shown in full only here; the
 * queue, admin, and chat never load or show it unmasked.
 */
function HmoCoverage({
  hmo,
  copayCentavos,
  decision,
}: {
  hmo: FrontDeskHmo;
  /** Null once a denial made the visit self-pay. */
  copayCentavos: number | null;
  /** Set while the coverage is still to be checked on a pending request. */
  decision: { paymentId: string; appointmentId: string } | null;
}) {
  return (
    <section aria-labelledby="hmo-heading" className="mt-5 border-t border-line pt-4">
      <h3 id="hmo-heading" className="text-base font-semibold text-ink">
        HMO coverage
      </h3>
      <dl className={`mt-3 ${DETAIL_LIST}`}>
        <Row label="Provider">{hmo.providerName}</Row>
        <Row label="Member number">
          <span className="font-mono">{hmo.memberNumber}</span>
        </Row>
        {copayCentavos !== null ? <Row label="Co-pay">{formatPesos(copayCentavos)}</Row> : null}
        {hmo.loaNumber ? (
          <Row label="LOA number">
            <span className="font-mono">{hmo.loaNumber}</span>
          </Row>
        ) : null}
        {hmo.deniedReason ? <Row label="Coverage denied">{hmo.deniedReason}</Row> : null}
      </dl>
      {decision ? (
        <>
          <p className="mt-3 text-sm text-ink-muted">
            Check the patient&apos;s LOA or eligibility with the HMO before confirming.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <ApproveHmoDialog {...decision} />
            <DenyHmoDialog {...decision} />
          </div>
        </>
      ) : null}
    </section>
  );
}
