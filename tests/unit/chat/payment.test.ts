import { describe, expect, it } from "vitest";

import { formatManilaTime } from "@/lib/appointments/format";
import {
  PAYMENT_COPY,
  formatPaymentDeadline,
  hmoPendingCopy,
  maskMemberNumber,
  modelHistory,
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

  it("masks an HMO member number to its last 4 characters", () => {
    expect(maskMemberNumber("1234-5678-4417")).toBe("••••4417");
    expect(maskMemberNumber("417")).toBe("••••417");
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
