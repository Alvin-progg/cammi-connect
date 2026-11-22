// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  rejectReceipt,
  verifyPayment,
  viewReceipt,
  type PatientChatNotifier,
  type PaymentDecisionStore,
} from "@/server/payments/verification";

vi.mock("server-only", () => ({}));

const PAYMENT_ID = "00000000-0000-4000-8000-000000000901";
const STAFF_ID = "00000000-0000-4000-8000-000000000301";
const PATIENT_ID = "00000000-0000-4000-8000-000000000401";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000501";
const NOW = new Date("2026-11-17T06:00:00.000Z");

function fakes() {
  const store = {
    verify: vi.fn(),
    reject: vi.fn(),
    recordReceiptView: vi.fn(),
    signReceiptUrl: vi.fn(),
  } satisfies PaymentDecisionStore;
  const chat = {
    latestConversationId: vi.fn().mockResolvedValue(CONVERSATION_ID),
    appendMessages: vi.fn().mockResolvedValue([]),
  } satisfies PatientChatNotifier;
  return { store, chat };
}

let store: ReturnType<typeof fakes>["store"];
let chat: ReturnType<typeof fakes>["chat"];

beforeEach(() => {
  ({ store, chat } = fakes());
});

const verifyInput = {
  paymentId: PAYMENT_ID,
  staffId: STAFF_ID,
  transactionReference: "GC-1234",
  amountReceivedCentavos: 56000,
  receivedAt: "2026-11-17T05:45:00.000Z",
};

describe("verifyPayment", () => {
  it("verifies, then tells the patient in their latest chat with a templated message", async () => {
    store.verify.mockResolvedValue({ ok: true, patientId: PATIENT_ID, amountDueCentavos: 56000 });

    expect(await verifyPayment(verifyInput, store, chat, NOW)).toEqual({ ok: true });

    expect(store.verify).toHaveBeenCalledWith(verifyInput);
    expect(chat.latestConversationId).toHaveBeenCalledWith(PATIENT_ID);
    expect(chat.appendMessages).toHaveBeenCalledWith(CONVERSATION_ID, [
      {
        role: "assistant",
        content: "Payment received ✔. Your appointment is now waiting for front desk confirmation.",
        payload: { kind: "payment_update" },
        createdAt: NOW,
      },
    ]);
  });

  it("skips the message when the patient has no conversation", async () => {
    store.verify.mockResolvedValue({ ok: true, patientId: PATIENT_ID, amountDueCentavos: 56000 });
    chat.latestConversationId.mockResolvedValue(null);

    expect(await verifyPayment(verifyInput, store, chat, NOW)).toEqual({ ok: true });
    expect(chat.appendMessages).not.toHaveBeenCalled();
  });

  it("still reports success when the chat message fails", async () => {
    store.verify.mockResolvedValue({ ok: true, patientId: PATIENT_ID, amountDueCentavos: 56000 });
    chat.appendMessages.mockRejectedValue(new Error("down"));

    expect(await verifyPayment(verifyInput, store, chat, NOW)).toEqual({ ok: true });
  });

  it.each([
    ["P0001", "duplicate_reference", "This transaction reference was already used to verify another payment."],
    ["23505", "duplicate key value", "This transaction reference was already used to verify another payment."],
    ["P0001", "amount_short", "The amount received is less than the amount due."],
    ["P0001", "not_open", "This payment isn't waiting to be verified. Refresh to see its current status."],
    ["P0001", "not_allowed", "You are not authorized to verify payments."],
  ])("explains refusal %s %s without sending a message", async (code, message, expected) => {
    store.verify.mockResolvedValue({ ok: false, error: { code, message } });

    expect(await verifyPayment(verifyInput, store, chat, NOW)).toEqual({ ok: false, message: expected });
    expect(chat.appendMessages).not.toHaveBeenCalled();
  });

  it("hides unknown database errors", async () => {
    store.verify.mockResolvedValue({ ok: false, error: { code: "XX000", message: "internal detail" } });

    const result = await verifyPayment(verifyInput, store, chat, NOW);
    expect(result).toEqual({ ok: false, message: "The payment could not be updated. Try again in a moment." });
  });
});

describe("rejectReceipt", () => {
  it("rejects and tells the patient why, naming the amount due", async () => {
    store.reject.mockResolvedValue({ ok: true, patientId: PATIENT_ID, amountDueCentavos: 56000 });

    const result = await rejectReceipt(
      {
        paymentId: PAYMENT_ID,
        staffId: STAFF_ID,
        reasonCode: "amount_different",
        details: null,
        rejectedReason: "Amount is different",
      },
      store,
      chat,
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect(store.reject).toHaveBeenCalledWith({
      paymentId: PAYMENT_ID,
      staffId: STAFF_ID,
      reasonCode: "amount_different",
      rejectedReason: "Amount is different",
    });
    expect(chat.appendMessages.mock.calls[0][1][0].content).toBe(
      "The front desk couldn't match your payment: amount is different from ₱560.00. Please check and send the correct receipt.",
    );
  });
});

describe("viewReceipt", () => {
  it("records the view before signing a 60-second URL", async () => {
    store.recordReceiptView.mockResolvedValue({ ok: true, storagePath: "p/x/r.jpg" });
    store.signReceiptUrl.mockResolvedValue("https://storage.example.test/signed");

    const result = await viewReceipt({ paymentId: PAYMENT_ID, staffId: STAFF_ID }, store);

    expect(result).toEqual({ ok: true, url: "https://storage.example.test/signed" });
    expect(store.signReceiptUrl).toHaveBeenCalledWith("p/x/r.jpg", 60);
    expect(store.recordReceiptView.mock.invocationCallOrder[0]).toBeLessThan(
      store.signReceiptUrl.mock.invocationCallOrder[0],
    );
  });

  it("signs nothing when the view is refused", async () => {
    store.recordReceiptView.mockResolvedValue({
      ok: false,
      error: { code: "P0001", message: "receipt_not_found" },
    });

    const result = await viewReceipt({ paymentId: PAYMENT_ID, staffId: STAFF_ID }, store);
    expect(result).toEqual({ ok: false, message: "No receipt has been sent for this payment." });
    expect(store.signReceiptUrl).not.toHaveBeenCalled();
  });
});
