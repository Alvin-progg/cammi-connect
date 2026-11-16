import "server-only";

import type { PaymentStatus } from "@/lib/billing/payments";
import {
  detectReceiptImageType,
  RECEIPT_MAX_BYTES,
  RECEIPT_UPLOADS_PER_WINDOW,
  RECEIPT_WINDOW_MINUTES,
} from "@/lib/billing/receipts";
import { PAYMENT_COPY } from "@/lib/chat/payment";
import type { ChatMessage } from "@/lib/chat/schemas";
import type { PatientApiAccess } from "@/server/auth/dal";
import type { ChatStore } from "@/server/chat/handler";

/**
 * Receipt storage and the cammi_connect_submit_payment_receipt call (0035).
 * Every read is scoped by the session's patient ID.
 */
export type ReceiptStore = {
  /** Null when the payment does not exist or is not the patient's. */
  findPaymentForPatient(
    patientId: string,
    paymentId: string,
  ): Promise<{ status: PaymentStatus; attempts: number } | null>;
  countRecentUploads(patientId: string, since: Date): Promise<number>;
  /** Never overwrites: each path is new. */
  uploadObject(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  removeObject(path: string): Promise<void>;
  submitReceipt(input: {
    patientId: string;
    paymentId: string;
    path: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<{ ok: true } | { ok: false; code: string }>;
};

export type ReceiptChatStore = Pick<ChatStore, "getConversation" | "appendMessages"> & {
  latestConversationId(patientId: string): Promise<string | null>;
};

export type ReceiptOutcome =
  | "ok"
  | "unauthenticated"
  | "forbidden"
  | "payments_disabled"
  | "not_found"
  | "invalid_request"
  | "too_large"
  | "unsupported_type"
  | "not_open"
  | "limit_reached"
  | "rate_limited"
  | "unavailable";

/** IDs and outcomes only; never amounts, references, or receipt content. */
export type ReceiptLogEntry = { requestId: string; outcome: ReceiptOutcome; status: number };

export type ReceiptUploadDeps = {
  resolvePatient: () => Promise<PatientApiAccess>;
  /** `payment.enabled` and `payment.max_receipts`. */
  loadPaymentSettings: () => Promise<{ enabled: boolean; maxReceipts: number }>;
  store: ReceiptStore;
  chat: ReceiptChatStore;
  now: () => Date;
  newId: () => string;
  log: (entry: ReceiptLogEntry) => void;
};

const ERRORS: Record<Exclude<ReceiptOutcome, "ok">, { status: number; message: string }> = {
  unauthenticated: { status: 401, message: "Please sign in to send a receipt." },
  forbidden: { status: 403, message: "Receipts can only be sent from patient accounts." },
  payments_disabled: {
    status: 503,
    message: "Online payment is turned off right now. Please pay at the hospital cashier.",
  },
  not_found: { status: 404, message: "This payment could not be found." },
  invalid_request: { status: 400, message: "Please choose a photo of your receipt." },
  too_large: { status: 413, message: "That photo is too large. Please send one up to 5 MB." },
  unsupported_type: { status: 415, message: "Please send a JPEG, PNG, or WebP photo." },
  not_open: { status: 409, message: "This payment isn't waiting for a receipt." },
  limit_reached: {
    status: 409,
    message:
      "You've sent the most receipts allowed for this payment. Please call or visit the front desk.",
  },
  rate_limited: {
    status: 429,
    message: "You've sent several receipts just now. Please wait a few minutes and try again.",
  },
  unavailable: {
    status: 503,
    message: "Your receipt couldn't be sent right now. Please try again in a moment.",
  },
};

/** 0035 refusal codes; anything else is a 503. */
const SUBMIT_REFUSALS: Record<string, Exclude<ReceiptOutcome, "ok">> = {
  payment_not_found: "not_found",
  payment_not_open: "not_open",
  receipt_limit_reached: "limit_reached",
  receipt_rate_limited: "rate_limited",
  invalid_receipt: "invalid_request",
};

const OPEN_STATUSES: readonly PaymentStatus[] = ["awaiting_payment", "rejected"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Room for the multipart boundaries and the conversation ID field.
const MAX_BODY_BYTES = RECEIPT_MAX_BYTES + 64 * 1024;
const NO_STORE = { "cache-control": "private, no-store" };

class Refusal extends Error {
  constructor(readonly outcome: Exclude<ReceiptOutcome, "ok">) {
    super(outcome);
  }
}

/**
 * POST /api/v1/payments/[id]/receipt (PAY-04, ADR-0005 amendment). Session,
 * ownership, attempt limit, rate limit, size, and file signature are checked
 * before anything is stored; the database function re-checks them in one
 * transaction, and a refused upload's object is removed. The image goes to
 * storage only, never to an AI provider.
 */
export async function handleReceiptUpload(
  request: Request,
  paymentId: string,
  deps: ReceiptUploadDeps,
): Promise<Response> {
  const requestId = deps.newId();

  function respond(outcome: ReceiptOutcome, body: object): Response {
    const status = outcome === "ok" ? 200 : ERRORS[outcome].status;
    deps.log({ requestId, outcome, status });
    return Response.json({ ...body, requestId }, { status, headers: NO_STORE });
  }

  try {
    const access = await deps.resolvePatient();
    if (access.status !== "ok") throw new Refusal(access.status);
    const patientId = access.patient.id;

    const settings = await deps.loadPaymentSettings();
    if (!settings.enabled) throw new Refusal("payments_disabled");

    // Checked before the body is read, so another patient's payment is
    // always "not found", whatever the file.
    const payment = UUID.test(paymentId)
      ? await deps.store.findPaymentForPatient(patientId, paymentId)
      : null;
    if (!payment) throw new Refusal("not_found");
    if (!OPEN_STATUSES.includes(payment.status)) throw new Refusal("not_open");
    if (payment.attempts >= settings.maxReceipts) throw new Refusal("limit_reached");

    const now = deps.now();
    const since = new Date(now.getTime() - RECEIPT_WINDOW_MINUTES * 60_000);
    if ((await deps.store.countRecentUploads(patientId, since)) >= RECEIPT_UPLOADS_PER_WINDOW) {
      throw new Refusal("rate_limited");
    }

    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      throw new Refusal("too_large");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new Refusal("invalid_request");
    }
    const file = form.get("receipt");
    if (!(file instanceof Blob)) throw new Refusal("invalid_request");
    if (file.size > RECEIPT_MAX_BYTES) throw new Refusal("too_large");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectReceiptImageType(bytes);
    if (!type) throw new Refusal("unsupported_type");

    // A random name: nothing from the patient (file name, reference) is in the path.
    const path = `${patientId}/${paymentId}/${crypto.randomUUID()}.${type.extension}`;
    await deps.store.uploadObject(path, bytes, type.contentType);

    let submitted: Awaited<ReturnType<ReceiptStore["submitReceipt"]>>;
    try {
      submitted = await deps.store.submitReceipt({
        patientId,
        paymentId,
        path,
        contentType: type.contentType,
        sizeBytes: bytes.byteLength,
      });
    } catch (error) {
      await deps.store.removeObject(path);
      throw error;
    }
    if (!submitted.ok) {
      await deps.store.removeObject(path);
      throw new Refusal(SUBMIT_REFUSALS[submitted.code] ?? "unavailable");
    }

    const message = await appendReceiptMessage(patientId, form.get("conversationId"), now, deps);
    return respond("ok", { payment: { status: "submitted" }, message });
  } catch (error) {
    const outcome = error instanceof Refusal ? error.outcome : "unavailable";
    const { message } = ERRORS[outcome];
    return respond(outcome, { error: { code: outcome, message } });
  }
}

/**
 * Cami's templated reply, in the chat the card was in, else the patient's
 * latest chat. The receipt is already submitted, so a failure here is not
 * reported as a failed upload.
 */
async function appendReceiptMessage(
  patientId: string,
  requestedId: FormDataEntryValue | null,
  now: Date,
  deps: ReceiptUploadDeps,
): Promise<ChatMessage | null> {
  try {
    const owned =
      typeof requestedId === "string" && UUID.test(requestedId)
        ? await deps.chat.getConversation(patientId, requestedId)
        : null;
    const conversationId = owned?.id ?? (await deps.chat.latestConversationId(patientId));
    if (!conversationId) return null;
    const [saved] = await deps.chat.appendMessages(conversationId, [
      { role: "assistant", content: PAYMENT_COPY.receiptReceived, payload: null, createdAt: now },
    ]);
    return saved ?? null;
  } catch {
    return null;
  }
}
