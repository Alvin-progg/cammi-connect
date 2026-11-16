// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { RECEIPT_MAX_BYTES, RECEIPT_UPLOADS_PER_WINDOW } from "@/lib/billing/receipts";
import { PAYMENT_COPY } from "@/lib/chat/payment";
import type { PatientApiAccess } from "@/server/auth/dal";
import type { NewChatMessage } from "@/server/chat/handler";
import {
  handleReceiptUpload,
  type ReceiptLogEntry,
  type ReceiptUploadDeps,
} from "@/server/payments/receipts";

vi.mock("server-only", () => ({}));

const PATIENT = { id: "00000000-0000-4000-8000-000000000201", fullName: "Ana Cruz" };
const PAYMENT_ID = "00000000-0000-4000-8000-00000000a001";
const OTHER_PAYMENT_ID = "00000000-0000-4000-8000-00000000a999";
const CONVERSATION_ID = "00000000-0000-4000-8000-00000000c001";
const LATEST_CONVERSATION_ID = "00000000-0000-4000-8000-00000000c002";
const NOW = new Date("2026-11-17T01:00:00Z");
const REFERENCE = "CC-7F3K2";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

let ids: number;
let deps: ReceiptUploadDeps;
let logged: ReceiptLogEntry[];
let payment: { status: "awaiting_payment" | "rejected" | "submitted" | "verified"; attempts: number };

beforeEach(() => {
  ids = 0;
  logged = [];
  payment = { status: "awaiting_payment", attempts: 0 };
  deps = {
    resolvePatient: vi.fn(async (): Promise<PatientApiAccess> => ({ status: "ok", patient: PATIENT })),
    loadPaymentSettings: vi.fn(async () => ({ enabled: true, maxReceipts: 3 })),
    store: {
      findPaymentForPatient: vi.fn(async (patientId: string, paymentId: string) =>
        patientId === PATIENT.id && paymentId === PAYMENT_ID ? payment : null,
      ),
      countRecentUploads: vi.fn(async () => 0),
      uploadObject: vi.fn(async () => {}),
      removeObject: vi.fn(async () => {}),
      submitReceipt: vi.fn(async () => ({ ok: true as const })),
    },
    chat: {
      getConversation: vi.fn(async (patientId: string, conversationId: string) =>
        patientId === PATIENT.id && conversationId === CONVERSATION_ID
          ? { id: CONVERSATION_ID, title: "Booking", updatedAt: NOW.toISOString() }
          : null,
      ),
      latestConversationId: vi.fn(async () => LATEST_CONVERSATION_ID),
      appendMessages: vi.fn(async (_conversationId: string, messages: NewChatMessage[]) =>
        messages.map((message, index) => ({
          id: `saved-${index}`,
          role: message.role,
          content: message.content,
          payload: message.payload ?? null,
          createdAt: message.createdAt.toISOString(),
        })),
      ),
    },
    now: () => NOW,
    newId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`,
    log: (entry) => logged.push(entry),
  };
});

function upload(
  file: Blob | null,
  { paymentId = PAYMENT_ID, conversationId }: { paymentId?: string; conversationId?: string } = {},
) {
  const form = new FormData();
  if (file) form.append("receipt", file, `${REFERENCE}.jpg`);
  if (conversationId) form.append("conversationId", conversationId);
  const request = new Request(`http://localhost/api/v1/payments/${paymentId}/receipt`, {
    method: "POST",
    body: form,
  });
  return handleReceiptUpload(request, paymentId, deps);
}

const image = (bytes: Uint8Array, type = "image/jpeg") => new Blob([bytes.slice().buffer], { type });

async function errorCode(response: Response): Promise<string> {
  const body: { error: { code: string } } = await response.json();
  return body.error.code;
}

describe("POST /api/v1/payments/[id]/receipt (PAY-04)", () => {
  it("answers 401 and 403 before reading anything", async () => {
    vi.mocked(deps.resolvePatient).mockResolvedValueOnce({ status: "unauthenticated" });
    expect((await upload(image(JPEG))).status).toBe(401);
    vi.mocked(deps.resolvePatient).mockResolvedValueOnce({ status: "forbidden" });
    expect((await upload(image(JPEG))).status).toBe(403);
    expect(deps.store.findPaymentForPatient).not.toHaveBeenCalled();
  });

  it("refuses while payment.enabled is off", async () => {
    vi.mocked(deps.loadPaymentSettings).mockResolvedValueOnce({ enabled: false, maxReceipts: 3 });
    const response = await upload(image(JPEG));
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("payments_disabled");
    expect(deps.store.uploadObject).not.toHaveBeenCalled();
  });

  it("reports another patient's payment, and a malformed ID, as not found", async () => {
    const other = await upload(image(JPEG), { paymentId: OTHER_PAYMENT_ID });
    expect(other.status).toBe(404);
    expect(await errorCode(other)).toBe("not_found");
    expect((await upload(image(JPEG), { paymentId: "not-a-uuid" })).status).toBe(404);
    expect(deps.store.uploadObject).not.toHaveBeenCalled();
  });

  it("rejects GIF, PDF, renamed text, and empty files with 415 whatever their name or type says", async () => {
    const encoder = new TextEncoder();
    for (const file of [
      image(encoder.encode("GIF89a\x01\x00\x01\x00"), "image/gif"),
      image(encoder.encode("%PDF-1.7\n"), "application/pdf"),
      image(encoder.encode("just text"), "image/jpeg"),
      image(new Uint8Array(), "image/png"),
    ]) {
      const response = await upload(file);
      expect(response.status).toBe(415);
      expect(await errorCode(response)).toBe("unsupported_type");
    }
    expect(deps.store.uploadObject).not.toHaveBeenCalled();
  });

  it("rejects a file over 5 MB with 413", async () => {
    const big = new Uint8Array(RECEIPT_MAX_BYTES + 1);
    big.set(JPEG);
    const response = await upload(image(big));
    expect(response.status).toBe(413);
    expect(deps.store.uploadObject).not.toHaveBeenCalled();
  });

  it("answers 400 when no file is sent", async () => {
    expect((await upload(null)).status).toBe(400);
  });

  it("refuses a payment that isn't waiting for a receipt", async () => {
    payment = { status: "verified", attempts: 1 };
    const response = await upload(image(JPEG));
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("not_open");
  });

  it("refuses once the patient has used every attempt", async () => {
    payment = { status: "rejected", attempts: 3 };
    const response = await upload(image(JPEG));
    expect(response.status).toBe(409);
    expect(await errorCode(response)).toBe("limit_reached");
    expect(deps.store.uploadObject).not.toHaveBeenCalled();
  });

  it("rate-limits uploads per patient", async () => {
    vi.mocked(deps.store.countRecentUploads).mockResolvedValueOnce(RECEIPT_UPLOADS_PER_WINDOW);
    const response = await upload(image(JPEG));
    expect(response.status).toBe(429);
    expect(vi.mocked(deps.store.countRecentUploads).mock.calls[0]).toEqual([
      PATIENT.id,
      new Date(NOW.getTime() - 10 * 60_000),
    ]);
    expect(deps.store.uploadObject).not.toHaveBeenCalled();
  });

  it("stores the image under a random name in the patient's folder and submits it", async () => {
    const response = await upload(image(PNG, "image/jpeg"), { conversationId: CONVERSATION_ID });

    expect(response.status).toBe(200);
    const [path, bytes, contentType] = vi.mocked(deps.store.uploadObject).mock.calls[0];
    expect(path).toMatch(
      new RegExp(`^${PATIENT.id}/${PAYMENT_ID}/[0-9a-f-]{36}\\.png$`),
    );
    expect(path).not.toContain(REFERENCE);
    expect(bytes).toEqual(PNG);
    // The detected type wins over the browser's claim.
    expect(contentType).toBe("image/png");
    expect(deps.store.submitReceipt).toHaveBeenCalledWith({
      patientId: PATIENT.id,
      paymentId: PAYMENT_ID,
      path,
      contentType: "image/png",
      sizeBytes: PNG.byteLength,
    });

    const body = await response.json();
    expect(body.payment).toEqual({ status: "submitted" });
    expect(deps.chat.appendMessages).toHaveBeenCalledWith(CONVERSATION_ID, [
      { role: "assistant", content: PAYMENT_COPY.receiptReceived, payload: null, createdAt: NOW },
    ]);
    expect(body.message.content).toBe(
      "Got your receipt, thank you! The front desk will check it and I'll let you know here.",
    );
  });

  it("posts the receipt message to the latest chat when the conversation isn't the patient's", async () => {
    await upload(image(JPEG), { conversationId: "00000000-0000-4000-8000-00000000cfff" });
    expect(vi.mocked(deps.chat.appendMessages).mock.calls[0][0]).toBe(LATEST_CONVERSATION_ID);
  });

  it("still succeeds when there is no chat to post to", async () => {
    vi.mocked(deps.chat.latestConversationId).mockResolvedValueOnce(null);
    const response = await upload(image(JPEG));
    expect(response.status).toBe(200);
    expect((await response.json()).message).toBeNull();
  });

  it("removes the stored object when the database refuses, and maps the refusal", async () => {
    vi.mocked(deps.store.submitReceipt).mockResolvedValueOnce({ ok: false, code: "receipt_rate_limited" });
    const response = await upload(image(JPEG));
    expect(response.status).toBe(429);
    const [path] = vi.mocked(deps.store.uploadObject).mock.calls[0];
    expect(deps.store.removeObject).toHaveBeenCalledWith(path);
    expect(deps.chat.appendMessages).not.toHaveBeenCalled();
  });

  it("removes the stored object and answers 503 when the database call throws", async () => {
    vi.mocked(deps.store.submitReceipt).mockRejectedValueOnce(new Error(`boom ${REFERENCE}`));
    const response = await upload(image(JPEG));
    expect(response.status).toBe(503);
    expect(deps.store.removeObject).toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).not.toContain(REFERENCE);
  });

  it("logs IDs and outcomes only", async () => {
    await upload(image(JPEG));
    vi.mocked(deps.store.submitReceipt).mockRejectedValueOnce(new Error(`boom ${REFERENCE}`));
    await upload(image(JPEG));

    expect(logged.map(({ outcome, status }) => [outcome, status])).toEqual([
      ["ok", 200],
      ["unavailable", 503],
    ]);
    for (const entry of logged) {
      expect(Object.keys(entry).sort()).toEqual(["outcome", "requestId", "status"]);
    }
    expect(JSON.stringify(logged)).not.toMatch(new RegExp(`${REFERENCE}|${PAYMENT_ID}|${PATIENT.id}`));
  });
});

describe("receipt privacy", () => {
  it("never routes a receipt or payment data to an AI provider", () => {
    for (const file of ["src/server/payments/receipts.ts", "src/app/api/v1/payments/[id]/receipt/route.ts"]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/@\/server\/(ai|chat\/orchestrator|knowledge)/);
    }
  });
});
