// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { decideHmo, type HmoDecisionStore } from "@/server/payments/hmo";
import type { PatientChatNotifier } from "@/server/payments/verification";

vi.mock("server-only", () => ({}));

const PAYMENT_ID = "00000000-0000-4000-8000-000000000901";
const STAFF_ID = "00000000-0000-4000-8000-000000000301";
const PATIENT_ID = "00000000-0000-4000-8000-000000000401";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000501";
// 14:00 in Manila.
const NOW = new Date("2026-11-17T06:00:00.000Z");

function fakes() {
  const store = { decideHmo: vi.fn() } satisfies HmoDecisionStore;
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

const decided = (overrides: Record<string, unknown>) => ({
  ok: true,
  patientId: PATIENT_ID,
  status: "hmo_approved",
  method: null,
  amountDueCentavos: 0,
  deadline: null,
  referenceCode: "CC-7F3K2",
  hmoName: "Maxicare",
  ...overrides,
});

describe("decideHmo", () => {
  it("approves with the LOA number and tells the patient, with no amount", async () => {
    store.decideHmo.mockResolvedValue(decided({}));
    const input = { paymentId: PAYMENT_ID, staffId: STAFF_ID, decision: "approve" as const, loaNumber: "LOA-118" };

    expect(await decideHmo(input, store, chat, NOW)).toEqual({ ok: true });

    expect(store.decideHmo).toHaveBeenCalledWith(input);
    expect(chat.appendMessages).toHaveBeenCalledWith(CONVERSATION_ID, [
      {
        role: "assistant",
        content:
          "Your Maxicare coverage is approved ✔. Your appointment is now waiting for front desk confirmation. Please bring your HMO card and a valid ID.",
        payload: { kind: "payment_update" },
        createdAt: NOW,
      },
    ]);
  });

  it("denies and sends the new self-pay amount with the QR card", async () => {
    store.decideHmo.mockResolvedValue(
      decided({
        status: "awaiting_payment",
        method: "qr_ph",
        amountDueCentavos: 70000,
        deadline: "2026-11-17T08:00:00.000Z",
      }),
    );
    const input = { paymentId: PAYMENT_ID, staffId: STAFF_ID, decision: "deny" as const, reason: "Not eligible" };

    expect(await decideHmo(input, store, chat, NOW)).toEqual({ ok: true });

    const [message] = chat.appendMessages.mock.calls[0][1];
    expect(message.content).toBe(
      "Your HMO couldn't cover this visit. You can still pay ₱700.00 here to keep the slot. Please pay by 4:00 PM today: scan the QR with GCash, Maya, or your bank app, put CC-7F3K2 in the message/notes, and send me a photo of your receipt.",
    );
    expect(message.payload).toEqual({
      kind: "payment_update",
      payment: {
        id: PAYMENT_ID,
        method: "qr_ph",
        status: "awaiting_payment",
        amountDueCentavos: 70000,
        referenceCode: "CC-7F3K2",
        deadline: "2026-11-17T08:00:00.000Z",
      },
    });
    // The deny reason is internal; Cami never repeats it.
    expect(message.content).not.toContain("Not eligible");
  });

  it("sends no QR card when the visit is too soon and the cashier collects", async () => {
    store.decideHmo.mockResolvedValue(
      decided({ status: "collect_at_counter", method: "counter", amountDueCentavos: 56000 }),
    );

    await decideHmo({ paymentId: PAYMENT_ID, staffId: STAFF_ID, decision: "deny", reason: "Expired card" }, store, chat, NOW);

    const [message] = chat.appendMessages.mock.calls[0][1];
    expect(message.content).toMatch(/at the hospital cashier when you arrive/);
    expect(message.payload).toEqual({ kind: "payment_update" });
  });

  it.each([
    ["not_open", "This payment isn't waiting for an HMO decision. Refresh to see its current status."],
    ["not_pending", "This request is no longer pending. Refresh to see its current status."],
    ["not_allowed", "You are not authorized to decide HMO coverage."],
    ["loa_required", "Enter the LOA number from the HMO."],
    ["reason_required", "Write the reason the HMO denied coverage."],
  ])("explains refusal %s without sending a message", async (code, expected) => {
    store.decideHmo.mockResolvedValue({ ok: false, error: { code: "P0001", message: code } });

    const result = await decideHmo(
      { paymentId: PAYMENT_ID, staffId: STAFF_ID, decision: "approve", loaNumber: "LOA-1" },
      store,
      chat,
      NOW,
    );
    expect(result).toEqual({ ok: false, message: expected });
    expect(chat.appendMessages).not.toHaveBeenCalled();
  });

  it("hides unknown database errors", async () => {
    store.decideHmo.mockResolvedValue({ ok: false, error: { code: "XX000", message: "internal detail" } });

    const result = await decideHmo(
      { paymentId: PAYMENT_ID, staffId: STAFF_ID, decision: "deny", reason: "x" },
      store,
      chat,
      NOW,
    );
    expect(result).toEqual({ ok: false, message: "The payment could not be updated. Try again in a moment." });
  });
});
