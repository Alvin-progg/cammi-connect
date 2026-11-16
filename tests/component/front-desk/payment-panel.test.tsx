import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentPanel } from "@/components/front-desk/payment-panel";
import { RefundDueList } from "@/components/front-desk/refund-due-list";
import type { FrontDeskPayment } from "@/lib/billing/verification";
import {
  decideHmoAction,
  markRefundedAction,
  rejectReceiptAction,
  verifyPaymentAction,
  viewReceiptAction,
} from "@/server/payments/actions";

vi.mock("@/server/payments/actions", () => ({
  decideHmoAction: vi.fn(),
  markRefundedAction: vi.fn(),
  rejectReceiptAction: vi.fn(),
  verifyPaymentAction: vi.fn(),
  viewReceiptAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";
const NOW = new Date("2026-11-17T06:00:00.000Z");

const SUBMITTED: FrontDeskPayment = {
  id: "00000000-0000-4000-8000-000000000901",
  status: "submitted",
  method: "qr_ph",
  amountDueCentavos: 56000,
  deadline: "2026-11-17T08:30:00.000Z",
  attempts: 1,
  referenceCode: "CC-7F3K2",
  privilege: "senior",
  payer: "self",
  baseCentavos: 70000,
  vatExemptionCentavos: 0,
  privilegeDiscountCentavos: 14000,
  philhealthCentavos: 0,
  hmoCentavos: 0,
  transactionReference: null,
  amountReceivedCentavos: null,
  receivedAt: null,
  rejectedReason: null,
  refundReference: null,
  hasReceipt: true,
  hmo: null,
};

const HMO_DETAILS = { providerName: "Maxicare", memberNumber: "MAXI-0099-4417", loaNumber: null, deniedReason: null };

const HMO_PENDING: FrontDeskPayment = {
  ...SUBMITTED,
  status: "hmo_pending",
  method: null,
  deadline: null,
  attempts: 0,
  privilege: "none",
  payer: "hmo",
  privilegeDiscountCentavos: 0,
  hmoCentavos: 60000,
  amountDueCentavos: 10000,
  hasReceipt: false,
  hmo: HMO_DETAILS,
};

beforeEach(() => {
  vi.mocked(verifyPaymentAction).mockReset();
  vi.mocked(rejectReceiptAction).mockReset();
  vi.mocked(markRefundedAction).mockReset();
  vi.mocked(viewReceiptAction).mockReset();
  vi.mocked(decideHmoAction).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PaymentPanel", () => {
  it("shows the breakdown, reference code, deadline, and attempts", () => {
    render(<PaymentPanel appointmentId={APPOINTMENT_ID} payment={SUBMITTED} now={NOW} />);

    const panel = screen.getByRole("region", { name: "Payment" });
    expect(within(panel).getByText("Receipt to check")).toBeInTheDocument();
    expect(within(panel).getByText("CC-7F3K2")).toBeInTheDocument();
    expect(within(panel).getByText("₱700.00")).toBeInTheDocument();
    expect(within(panel).getByText("−₱140.00")).toBeInTheDocument();
    expect(within(panel).getByText("₱560.00")).toBeInTheDocument();
    expect(within(panel).getByText("1")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Verify payment" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Reject receipt" })).toBeInTheDocument();
  });

  it("verifies with the reference, amount, and time", async () => {
    vi.mocked(verifyPaymentAction).mockResolvedValue({ status: "success", message: "Payment verified." });
    const user = userEvent.setup();
    render(<PaymentPanel appointmentId={APPOINTMENT_ID} payment={SUBMITTED} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Verify payment" }));
    const dialog = screen.getByRole("dialog", { name: "Verify this payment?" });
    await user.type(within(dialog).getByLabelText("Transaction reference"), "GC-1234");
    await user.type(within(dialog).getByLabelText("Amount received (₱)"), "560");
    await user.type(within(dialog).getByLabelText("Time received"), "2026-11-17T13:45");
    await user.click(within(dialog).getByRole("button", { name: "Verify payment" }));

    await waitFor(() => expect(verifyPaymentAction).toHaveBeenCalledTimes(1));
    const form = vi.mocked(verifyPaymentAction).mock.calls[0][1];
    expect(form.get("paymentId")).toBe(SUBMITTED.id);
    expect(form.get("appointmentId")).toBe(APPOINTMENT_ID);
    expect(form.get("transactionReference")).toBe("GC-1234");
    expect(form.get("amountReceived")).toBe("560");
    expect(form.get("receivedAt")).toBe("2026-11-17T13:45");
  });

  it("rejects a receipt with a preset reason", async () => {
    vi.mocked(rejectReceiptAction).mockResolvedValue({ status: "success", message: "Receipt rejected." });
    const user = userEvent.setup();
    render(<PaymentPanel appointmentId={APPOINTMENT_ID} payment={SUBMITTED} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Reject receipt" }));
    const dialog = screen.getByRole("alertdialog", { name: "Reject this receipt?" });
    await user.click(within(dialog).getByRole("radio", { name: "Amount is different" }));
    await user.click(within(dialog).getByRole("button", { name: "Reject receipt" }));

    await waitFor(() => expect(rejectReceiptAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(rejectReceiptAction).mock.calls[0][1].get("reason")).toBe("amount_different");
  });

  it("shows the receipt from a short-lived URL in a dialog", async () => {
    vi.mocked(viewReceiptAction).mockResolvedValue({ status: "success", url: "https://storage.example.test/s" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["x"], { type: "image/jpeg" }))));
    URL.createObjectURL = vi.fn(() => "blob:receipt");
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    render(<PaymentPanel appointmentId={APPOINTMENT_ID} payment={SUBMITTED} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "View receipt" }));

    expect(viewReceiptAction).toHaveBeenCalledWith(SUBMITTED.id);
    const dialog = await screen.findByRole("dialog", { name: "Payment receipt" });
    expect(within(dialog).getByRole("img", { name: "Receipt sent by the patient" })).toHaveAttribute(
      "src",
      "blob:receipt",
    );
  });

  it("offers no actions for an HMO payment (PAY-06) and none to doctors' statuses", () => {
    render(
      <PaymentPanel
        appointmentId={APPOINTMENT_ID}
        payment={{ ...SUBMITTED, status: "hmo_pending", payer: "hmo", hasReceipt: false }}
        now={NOW}
      />,
    );
    expect(screen.getByText("HMO to check")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify payment" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject receipt" })).toBeNull();
  });

  it("lets a counter payment be verified without a receipt", () => {
    render(
      <PaymentPanel
        appointmentId={APPOINTMENT_ID}
        payment={{ ...SUBMITTED, status: "awaiting_payment", method: "counter", hasReceipt: false }}
        now={NOW}
      />,
    );
    expect(screen.getByRole("button", { name: "Verify payment" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject receipt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "View receipt" })).toBeNull();
  });

  it("marks a refund due payment refunded", async () => {
    vi.mocked(markRefundedAction).mockResolvedValue({ status: "success", message: "Refund recorded." });
    const user = userEvent.setup();
    render(
      <PaymentPanel
        appointmentId={APPOINTMENT_ID}
        payment={{ ...SUBMITTED, status: "refund_due", transactionReference: "GC-1234" }}
        now={NOW}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Mark refunded" }));
    const dialog = screen.getByRole("dialog", { name: "Mark this payment refunded?" });
    await user.type(within(dialog).getByLabelText("Refund reference"), "R-77");
    await user.click(within(dialog).getByRole("button", { name: "Mark refunded" }));

    await waitFor(() => expect(markRefundedAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(markRefundedAction).mock.calls[0][1].get("refundReference")).toBe("R-77");
  });
});

describe("PaymentPanel HMO coverage (PAY-06)", () => {
  it("shows the provider, the full member number, and the co-pay to the front desk", () => {
    render(<PaymentPanel appointmentId={APPOINTMENT_ID} payment={HMO_PENDING} now={NOW} />);

    const hmo = screen.getByRole("region", { name: "HMO coverage" });
    expect(within(hmo).getByText("Maxicare")).toBeInTheDocument();
    expect(within(hmo).getByText("MAXI-0099-4417")).toBeInTheDocument();
    expect(within(hmo).getByText("₱100.00")).toBeInTheDocument();
    expect(within(hmo).getByRole("button", { name: "Approve coverage" })).toBeInTheDocument();
    expect(within(hmo).getByRole("button", { name: "Deny coverage" })).toBeInTheDocument();
  });

  it("approves coverage with the LOA number", async () => {
    vi.mocked(decideHmoAction).mockResolvedValue({ status: "success", message: "HMO coverage approved." });
    const user = userEvent.setup();
    render(<PaymentPanel appointmentId={APPOINTMENT_ID} payment={HMO_PENDING} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Approve coverage" }));
    const dialog = screen.getByRole("dialog", { name: "Approve HMO coverage?" });
    await user.type(within(dialog).getByLabelText("LOA number"), "LOA-2026-118");
    await user.click(within(dialog).getByRole("button", { name: "Approve coverage" }));

    await waitFor(() => expect(decideHmoAction).toHaveBeenCalledTimes(1));
    const form = vi.mocked(decideHmoAction).mock.calls[0][1];
    expect(form.get("decision")).toBe("approve");
    expect(form.get("paymentId")).toBe(HMO_PENDING.id);
    expect(form.get("appointmentId")).toBe(APPOINTMENT_ID);
    expect(form.get("loaNumber")).toBe("LOA-2026-118");
  });

  it("denies coverage with a reason", async () => {
    vi.mocked(decideHmoAction).mockResolvedValue({ status: "success", message: "HMO coverage denied." });
    const user = userEvent.setup();
    render(<PaymentPanel appointmentId={APPOINTMENT_ID} payment={HMO_PENDING} now={NOW} />);

    await user.click(screen.getByRole("button", { name: "Deny coverage" }));
    const dialog = screen.getByRole("alertdialog", { name: "Deny HMO coverage?" });
    await user.type(within(dialog).getByLabelText("Reason"), "Member not eligible");
    await user.click(within(dialog).getByRole("button", { name: "Deny coverage" }));

    await waitFor(() => expect(decideHmoAction).toHaveBeenCalledTimes(1));
    const form = vi.mocked(decideHmoAction).mock.calls[0][1];
    expect(form.get("decision")).toBe("deny");
    expect(form.get("reason")).toBe("Member not eligible");
  });

  it("shows the LOA number once approved, with no actions", () => {
    render(
      <PaymentPanel
        appointmentId={APPOINTMENT_ID}
        payment={{ ...HMO_PENDING, status: "hmo_approved", hmo: { ...HMO_DETAILS, loaNumber: "LOA-2026-118" } }}
        now={NOW}
      />,
    );
    const hmo = screen.getByRole("region", { name: "HMO coverage" });
    expect(within(hmo).getByText("LOA-2026-118")).toBeInTheDocument();
    expect(within(hmo).queryByRole("button")).toBeNull();
  });

  it("shows the denial reason once denied, and the payment is self-pay", () => {
    render(
      <PaymentPanel
        appointmentId={APPOINTMENT_ID}
        payment={{
          ...HMO_PENDING,
          status: "awaiting_payment",
          method: "qr_ph",
          payer: "self",
          hmoCentavos: 0,
          amountDueCentavos: 70000,
          hmo: { ...HMO_DETAILS, deniedReason: "Member not eligible" },
        }}
        now={NOW}
      />,
    );
    const hmo = screen.getByRole("region", { name: "HMO coverage" });
    expect(within(hmo).getByText("Member not eligible")).toBeInTheDocument();
    expect(within(hmo).queryByText("Co-pay")).toBeNull();
    expect(screen.getByRole("button", { name: "Verify payment" })).toBeInTheDocument();
  });

  it("hides the decisions once the request is no longer pending", () => {
    render(<PaymentPanel appointmentId={APPOINTMENT_ID} payment={HMO_PENDING} now={NOW} decidable={false} />);
    expect(screen.queryByRole("button", { name: "Approve coverage" })).toBeNull();
  });
});

describe("RefundDueList", () => {
  it("lists refunds due with a link to the request and Mark refunded", () => {
    render(
      <RefundDueList
        items={[
          {
            paymentId: SUBMITTED.id,
            appointmentId: APPOINTMENT_ID,
            patientName: "Synthetic Patient B",
            referenceCode: "CC-7F3K2",
            amountReceivedCentavos: 56000,
            transactionReference: "GC-1234",
          },
        ]}
      />,
    );

    const region = screen.getByRole("region", { name: "Refund due" });
    expect(within(region).getByRole("link", { name: "Synthetic Patient B" })).toHaveAttribute(
      "href",
      `/front-desk/requests/${APPOINTMENT_ID}`,
    );
    expect(within(region).getByText("₱560.00")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Mark refunded" })).toBeInTheDocument();
  });
});
