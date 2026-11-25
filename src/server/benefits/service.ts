import "server-only";

import { randomUUID } from "node:crypto";

import { detectReceiptImageType, RECEIPT_MAX_BYTES, type ReceiptImageType } from "@/lib/billing/receipts";
import type {
  AccreditationStatus,
  AuthorizationStatus,
  CoverageStatus,
  VerificationStatus,
} from "@/lib/benefits/types";

/**
 * BEN-03 benefits business rules. The store is injected so tests use vi.fn()
 * fakes; the Supabase implementation lives in ./repository.ts. Every RPC
 * re-checks the staff role and the patient role in SQL (0041, 0042).
 */

export type RpcResult<T> = { ok: true; value: T } | { ok: false; code: string };

export type BenefitsResult = { ok: true } | { ok: false; message: string };

/**
 * recordId is the patient ID for a PWD declaration (one per patient) and the
 * patient_hmo ID for an HMO membership. The SQL functions read it the same way.
 */
export type BenefitKind = "pwd" | "hmo";

export type BenefitsWriteStore = {
  uploadDocument(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  removeDocument(path: string): Promise<void>;
  submitPwd(input: { patientId: string; idNumber: string; imagePath: string }): Promise<RpcResult<void>>;
  submitHmo(input: {
    patientId: string;
    providerId: string;
    membershipNumber: string;
    cardPath: string | null;
  }): Promise<RpcResult<string>>;
  decideBenefit(input: {
    kind: BenefitKind;
    recordId: string;
    staffId: string;
    decision: "verify" | "reject";
    reason: string | null;
  }): Promise<RpcResult<VerificationStatus>>;
  saveAccreditation(input: {
    actorId: string;
    doctorId: string;
    providerId: string;
    status: AccreditationStatus;
    validFrom: string;
    validUntil: string | null;
  }): Promise<RpcResult<string>>;
  updateAppointmentHmo(input: {
    appointmentId: string;
    staffId: string;
    authorization: AuthorizationStatus;
    coverage: CoverageStatus;
    loaNumber: string | null;
    remarks: string | null;
  }): Promise<RpcResult<void>>;
  recordDocumentView(input: { kind: BenefitKind; recordId: string; staffId: string }): Promise<RpcResult<string>>;
  signDocument(path: string, expiresInSeconds: number): Promise<string>;
};

/** Patient-facing wording only; database and provider text never reaches the page. */
const FAILURE_MESSAGES: Record<string, string> = {
  not_allowed: "You are not allowed to do that.",
  not_pending: "This record has already been decided.",
  not_found: "Record not found.",
  reason_required: "Give a reason to reject.",
  provider_inactive: "That HMO provider is not available right now.",
  invalid_status: "Check the details and try again.",
  invalid_dates: "Check the dates and try again.",
};
const GENERIC_FAILURE = "Could not save. Try again.";
const DOCUMENT_OPEN_FAILURE = "Could not open the document. Try again.";

function failureMessage(code: string): string {
  return FAILURE_MESSAGES[code] ?? GENERIC_FAILURE;
}

/** Magic-byte check and size limit, as for receipts. Returns an error message or the type. */
export type ImageCheck = { error: string } | { type: ReceiptImageType };

export function checkImage(bytes: Uint8Array): ImageCheck {
  const type = detectReceiptImageType(bytes);
  if (!type) return { error: "Upload a JPEG, PNG, or WebP image." };
  if (bytes.length > RECEIPT_MAX_BYTES) return { error: "The image must be 5 MB or smaller." };
  return { type };
}

/**
 * Stores the image under a random name in the patient's folder, then submits.
 * If the database refuses, the new file is removed so nothing is orphaned.
 */
async function storeAndSubmit(
  store: BenefitsWriteStore,
  folder: string,
  image: { bytes: Uint8Array; type: { contentType: string; extension: string } },
  submit: (path: string) => Promise<RpcResult<unknown>>,
): Promise<BenefitsResult> {
  const path = `${folder}/${randomUUID()}.${image.type.extension}`;
  await store.uploadDocument(path, image.bytes, image.type.contentType);
  const result = await submit(path);
  if (!result.ok) {
    await store.removeDocument(path);
    return { ok: false, message: failureMessage(result.code) };
  }
  return { ok: true };
}

export async function submitPwdDeclaration(
  input: { patientId: string; idNumber: string; image: Uint8Array },
  store: BenefitsWriteStore,
): Promise<BenefitsResult> {
  const checked = checkImage(input.image);
  if ("error" in checked) return { ok: false, message: checked.error };

  return storeAndSubmit(
    store,
    `${input.patientId}/pwd`,
    { bytes: input.image, type: checked.type },
    (imagePath) => store.submitPwd({ patientId: input.patientId, idNumber: input.idNumber, imagePath }),
  );
}

/** The card is optional; without a new card the stored card stays (0041 keeps it). */
export async function submitHmoMembership(
  input: {
    patientId: string;
    providerId: string;
    membershipNumber: string;
    card: Uint8Array | null;
  },
  store: BenefitsWriteStore,
): Promise<BenefitsResult> {
  if (!input.card) {
    const result = await store.submitHmo({
      patientId: input.patientId,
      providerId: input.providerId,
      membershipNumber: input.membershipNumber,
      cardPath: null,
    });
    return result.ok ? { ok: true } : { ok: false, message: failureMessage(result.code) };
  }

  const checked = checkImage(input.card);
  if ("error" in checked) return { ok: false, message: checked.error };

  return storeAndSubmit(
    store,
    `${input.patientId}/hmo`,
    { bytes: input.card, type: checked.type },
    (cardPath) =>
      store.submitHmo({
        patientId: input.patientId,
        providerId: input.providerId,
        membershipNumber: input.membershipNumber,
        cardPath,
      }),
  );
}

export async function decideBenefit(
  input: Parameters<BenefitsWriteStore["decideBenefit"]>[0],
  store: BenefitsWriteStore,
): Promise<{ ok: true; status: VerificationStatus } | { ok: false; message: string }> {
  const result = await store.decideBenefit(input);
  return result.ok ? { ok: true, status: result.value } : { ok: false, message: failureMessage(result.code) };
}

export async function saveDoctorAccreditation(
  input: Parameters<BenefitsWriteStore["saveAccreditation"]>[0],
  store: BenefitsWriteStore,
): Promise<BenefitsResult> {
  const result = await store.saveAccreditation(input);
  return result.ok ? { ok: true } : { ok: false, message: failureMessage(result.code) };
}

export async function updateAppointmentHmo(
  input: Parameters<BenefitsWriteStore["updateAppointmentHmo"]>[0],
  store: BenefitsWriteStore,
): Promise<BenefitsResult> {
  const result = await store.updateAppointmentHmo(input);
  return result.ok ? { ok: true } : { ok: false, message: failureMessage(result.code) };
}

/** Audited first; the signed link is created only after the view is recorded. */
export async function viewBenefitDocument(
  input: { kind: BenefitKind; recordId: string; staffId: string },
  store: BenefitsWriteStore,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const recorded = await store.recordDocumentView(input);
  if (!recorded.ok) return { ok: false, message: failureMessage(recorded.code) };
  try {
    const url = await store.signDocument(recorded.value, 60);
    return { ok: true, url };
  } catch {
    // Storage errors can carry provider text; the staff user sees only this fixed line.
    return { ok: false, message: DOCUMENT_OPEN_FAILURE };
  }
}
