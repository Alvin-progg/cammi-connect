import { describe, expect, it } from "vitest";

import { formatManilaTime } from "@/lib/appointments/format";
import {
  PAYMENT_COPY,
  formatPaymentDeadline,
  hmoApprovedCopy,
  hmoDeniedCopy,
  hmoPendingCopy,
  modelHistory,
  receiptRejectedCopy,
  refundSentCopy,
  paymentQrImageSrc,
  paymentRequestCopy,
} from "@/lib/chat/payment";
import type { ChatMessage } from "@/lib/chat/schemas";

// Saturday 2026-10-31, 09:00 in Manila.
const NOW = new Date("2026-10-31T01:00:00Z");

describe("payment copy (PAY-03)", () => {
  it("uses the spec's discount and payer questions", () => {
    expect(PAYMENT_COPY.privilegeQuestion).toBe(
      "Do any of these apply to you? You'll need to show the ID at the front desk.",
    );
    expect(PAYMENT_COPY.payerQuestion).toBe("How will this be paid?");
  });

  it("asks a QR payer for the exact amount, deadline, and reference code", () => {
    const text = paymentRequestCopy({
      amountDueCentavos: 56000,
      referenceCode: "CC-7F3K2",
      deadline: "2026-10-31T08:30:00Z",
      method: "qr_ph",
      now: NOW,
    });

    expect(text).toContain("Almost done! To hold your slot, please pay ₱560.00 by 4:30 PM today");
    expect(text).toContain("CC-7F3K2");
  });

  it("uses the spec's payment request with the QR and receipt steps (PAY-04)", () => {
    const text = paymentRequestCopy({
      amountDueCentavos: 56000,
      referenceCode: "CC-7F3K2",
      deadline: "2026-10-31T08:30:00Z",
      method: "qr_ph",
      now: NOW,
    });

    expect(text).toBe(
      "Almost done! To hold your slot, please pay ₱560.00 by 4:30 PM today. Scan the QR with GCash, Maya, or your bank app and put CC-7F3K2 in the message/notes. Then send me a photo of your receipt here.",
    );
    expect(PAYMENT_COPY.receiptReceived).toBe(
      "Got your receipt, thank you! The front desk will check it and I'll let you know here.",
    );
  });

  it("only shows a same-site QR image path", () => {
    expect(paymentQrImageSrc("/payment/qr-synthetic-demo.svg")).toBe("/payment/qr-synthetic-demo.svg");
    expect(paymentQrImageSrc("  /payment/qr.png ")).toBe("/payment/qr.png");
    for (const unsafe of ["", "https://evil.example/qr.png", "//evil.example/qr.png", "javascript:alert(1)", "qr.png", "/\\evil"]) {
      expect(paymentQrImageSrc(unsafe)).toBeNull();
    }
  });

  it("sends a counter payer to the cashier with the same deadline", () => {
    const text = paymentRequestCopy({
      amountDueCentavos: 70000,
      referenceCode: "CC-ABCDE",
      deadline: "2026-10-31T08:30:00Z",
      method: "counter",
      now: NOW,
    });

    expect(text).toContain("₱700.00");
    expect(text).toContain("cashier");
    expect(text).toContain("4:30 PM today");
    expect(text).toContain("CC-ABCDE");
  });

  it("says today, tomorrow, or the date for the deadline", () => {
    expect(formatPaymentDeadline("2026-10-31T08:30:00Z", NOW)).toBe("4:30 PM today");
    expect(formatPaymentDeadline("2026-11-01T00:30:00Z", NOW)).toBe(
      `${formatManilaTime("2026-11-01T00:30:00Z")} tomorrow`,
    );
    expect(formatPaymentDeadline("2026-11-03T00:30:00Z", NOW)).toMatch(/^8:30 AM on /);
  });

  it("names the HMO in the HMO pending message", () => {
    expect(hmoPendingCopy("Maxicare")).toBe(
      "Thanks! The front desk will check your Maxicare coverage. Please request an LOA in your HMO app and bring your HMO card and a valid ID.",
    );
  });

});

function assistant(content: string, payload: ChatMessage["payload"]): ChatMessage {
  return { id: "m", role: "assistant", content, payload, createdAt: "2026-10-31T01:00:00Z" };
}

describe("modelHistory", () => {
  it("never passes payment amounts or reference codes to the model", () => {
    const history = modelHistory([
      { id: "u", role: "user", content: "Confirm booking", payload: null, createdAt: "x" },
      assistant("Almost done! To hold your slot, please pay ₱560.00 … CC-7F3K2", {
        kind: "booking_result",
        doctorName: "Dr. Maya Santos",
        start: "2026-11-03T01:00:00.000Z",
        end: "2026-11-03T01:30:00.000Z",
        payment: {
          status: "awaiting_payment",
          amountDueCentavos: 56000,
          referenceCode: "CC-7F3K2",
          deadline: "2026-10-31T03:00:00Z",
        },
      }),
      assistant("Hello!", null),
    ]);

    const text = JSON.stringify(history);
    expect(text).not.toContain("₱");
    expect(text).not.toContain("CC-7F3K2");
    expect(history).toEqual([
      { role: "user", content: "Confirm booking" },
      { role: "assistant", content: PAYMENT_COPY.hiddenFromModel },
      { role: "assistant", content: "Hello!" },
    ]);
  });
});

describe("HMO decisions (PAY-06)", () => {
  it("tells the patient their HMO approved the visit", () => {
    expect(hmoApprovedCopy("Maxicare")).toBe(
      "Your Maxicare coverage is approved ✔. Your appointment is now waiting for front desk confirmation. Please bring your HMO card and a valid ID.",
    );
  });

  it("uses the spec's denied text with the new amount, reference, and deadline for a QR payment", () => {
    expect(
      hmoDeniedCopy({
        status: "awaiting_payment",
        amountDueCentavos: 70000,
        referenceCode: "CC-7F3K2",
        deadline: "2026-10-31T08:30:00Z",
        now: NOW,
      }),
    ).toBe(
      "Your HMO couldn't cover this visit. You can still pay ₱700.00 here to keep the slot. Please pay by 4:30 PM today: scan the QR with GCash, Maya, or your bank app, put CC-7F3K2 in the message/notes, and send me a photo of your receipt.",
    );
  });

  it("asks to pay at the cashier when the visit is too soon for a QR payment", () => {
    expect(
      hmoDeniedCopy({
        status: "collect_at_counter",
        amountDueCentavos: 56000,
        referenceCode: "CC-7F3K2",
        deadline: null,
        now: NOW,
      }),
    ).toBe(
      "Your HMO couldn't cover this visit. Please pay ₱560.00 at the hospital cashier when you arrive and give the reference code CC-7F3K2.",
    );
  });

  it("says there is nothing to pay when the visit costs ₱0", () => {
    expect(
      hmoDeniedCopy({ status: "not_required", amountDueCentavos: 0, referenceCode: "CC-7F3K2", deadline: null, now: NOW }),
    ).toBe(
      "Your HMO couldn't cover this visit, but there's nothing to pay for it. Your appointment is now waiting for front desk confirmation.",
    );
  });

  it("hides an HMO denial with its payment card from the model", () => {
    const history = modelHistory([
      assistant("Your HMO couldn't cover this visit. You can still pay ₱700.00 …", {
        kind: "payment_update",
        payment: {
          id: "p1",
          method: "qr_ph",
          status: "awaiting_payment",
          amountDueCentavos: 70000,
          referenceCode: "CC-7F3K2",
          deadline: "2026-10-31T08:30:00Z",
        },
      }),
    ]);
    expect(JSON.stringify(history)).not.toContain("₱");
    expect(history).toEqual([{ role: "assistant", content: PAYMENT_COPY.hiddenFromModel }]);
  });
});

describe("front desk payment updates (PAY-05)", () => {
  it("uses the spec's verified and rejected texts", () => {
    expect(PAYMENT_COPY.paymentVerified).toBe(
      "Payment received ✔. Your appointment is now waiting for front desk confirmation.",
    );
    expect(receiptRejectedCopy("amount is different from ₱560.00")).toBe(
      "The front desk couldn't match your payment: amount is different from ₱560.00. Please check and send the correct receipt.",
    );
    expect(refundSentCopy("R-77")).toBe("Your refund has been sent. Refund reference: R-77.");
  });

  it("hides payment updates from the model", () => {
    const history = modelHistory([
      assistant(receiptRejectedCopy("amount is different from ₱560.00"), { kind: "payment_update" }),
    ]);
    expect(history).toEqual([{ role: "assistant", content: PAYMENT_COPY.hiddenFromModel }]);
  });
});
