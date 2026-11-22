// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RECEIPT_MAX_BYTES } from "@/lib/billing/receipts";
import {
  submitHmoMembership,
  submitPwdDeclaration,
  decideBenefit,
  saveDoctorAccreditation,
  updateAppointmentHmo,
  viewBenefitDocument,
  type BenefitsWriteStore,
} from "@/server/benefits/service";

const PATIENT_ID = "33333333-3333-4333-8333-333333333333";
const STAFF_ID = "44444444-4444-4444-8444-444444444444";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0]);

function fakeStore(overrides: Partial<BenefitsWriteStore> = {}): BenefitsWriteStore {
  return {
    uploadDocument: vi.fn(async () => undefined),
    removeDocument: vi.fn(async () => undefined),
    submitPwd: vi.fn(async () => ({ ok: true as const, value: undefined })),
    submitHmo: vi.fn(async () => ({ ok: true as const, value: "patient-hmo-id" })),
    decideBenefit: vi.fn(async () => ({ ok: true as const, value: "verified" as const })),
    saveAccreditation: vi.fn(async () => ({ ok: true as const, value: "accreditation-id" })),
    updateAppointmentHmo: vi.fn(async () => ({ ok: true as const, value: undefined })),
    recordDocumentView: vi.fn(async () => ({ ok: true as const, value: "patient/pwd/x.jpg" })),
    signDocument: vi.fn(async () => "https://signed.example/x"),
    ...overrides,
  };
}

describe("submitPwdDeclaration", () => {
  it("stores the image in the benefit bucket under the patient folder, then submits pending", async () => {
    const store = fakeStore();
    const result = await submitPwdDeclaration({ patientId: PATIENT_ID, idNumber: "PWD-1", image: JPEG }, store);

    expect(result).toEqual({ ok: true });
    const [uploadPath, bytes, contentType] = vi.mocked(store.uploadDocument).mock.calls[0];
    expect(uploadPath).toMatch(new RegExp(`^${PATIENT_ID}/pwd/[0-9a-f-]+\\.jpg$`));
    expect(bytes).toBe(JPEG);
    expect(contentType).toBe("image/jpeg");
    expect(store.submitPwd).toHaveBeenCalledWith({ patientId: PATIENT_ID, idNumber: "PWD-1", imagePath: uploadPath });
  });

  it("refuses a file whose magic bytes are not an accepted image, without uploading", async () => {
    const store = fakeStore();
    const result = await submitPwdDeclaration({ patientId: PATIENT_ID, idNumber: "PWD-1", image: PDF }, store);
    expect(result).toEqual({ ok: false, message: "Upload a JPEG, PNG, or WebP image." });
    expect(store.uploadDocument).not.toHaveBeenCalled();
  });

  it("refuses an image over 5 MB", async () => {
    const store = fakeStore();
    const oversized = new Uint8Array(RECEIPT_MAX_BYTES + 1);
    oversized.set(JPEG);
    const result = await submitPwdDeclaration({ patientId: PATIENT_ID, idNumber: "PWD-1", image: oversized }, store);
    expect(result).toEqual({ ok: false, message: "The image must be 5 MB or smaller." });
  });

  it("removes the uploaded image when the database refuses the submission", async () => {
    const store = fakeStore({
      submitPwd: vi.fn(async () => ({ ok: false as const, code: "not_allowed" })),
    });
    const result = await submitPwdDeclaration({ patientId: PATIENT_ID, idNumber: "PWD-1", image: JPEG }, store);
    expect(result).toEqual({ ok: false, message: "You are not allowed to do that." });
    const [uploadPath] = vi.mocked(store.uploadDocument).mock.calls[0];
    expect(store.removeDocument).toHaveBeenCalledWith(uploadPath);
  });
});

describe("submitHmoMembership", () => {
  it("submits without a card image when none is given", async () => {
    const store = fakeStore();
    const result = await submitHmoMembership(
      { patientId: PATIENT_ID, providerId: "p1", membershipNumber: "MX-1", card: null },
      store,
    );
    expect(result).toEqual({ ok: true });
    expect(store.uploadDocument).not.toHaveBeenCalled();
    expect(store.submitHmo).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      providerId: "p1",
      membershipNumber: "MX-1",
      cardPath: null,
    });
  });

  it("maps an inactive provider to a patient-facing message", async () => {
    const store = fakeStore({
      submitHmo: vi.fn(async () => ({ ok: false as const, code: "provider_inactive" })),
    });
    const result = await submitHmoMembership(
      { patientId: PATIENT_ID, providerId: "p1", membershipNumber: "MX-1", card: null },
      store,
    );
    expect(result).toEqual({ ok: false, message: "That HMO provider is not available right now." });
  });
});

describe("decisions", () => {
  it("passes the staff ID from the session and returns the new status", async () => {
    const store = fakeStore();
    const result = await decideBenefit(
      { kind: "pwd", recordId: PATIENT_ID, staffId: STAFF_ID, decision: "verify", reason: null },
      store,
    );
    expect(result).toEqual({ ok: true, status: "verified" });
    expect(store.decideBenefit).toHaveBeenCalledWith({
      kind: "pwd",
      recordId: PATIENT_ID,
      staffId: STAFF_ID,
      decision: "verify",
      reason: null,
    });
  });

  it("reports an already-decided record", async () => {
    const store = fakeStore({
      decideBenefit: vi.fn(async () => ({ ok: false as const, code: "not_pending" })),
    });
    const result = await decideBenefit(
      { kind: "hmo", recordId: "x", staffId: STAFF_ID, decision: "reject", reason: "Card unreadable" },
      store,
    );
    expect(result).toEqual({ ok: false, message: "This record has already been decided." });
  });
});

describe("accreditation and appointment HMO", () => {
  it("saves accreditation for an admin with the validated fields", async () => {
    const store = fakeStore();
    await saveDoctorAccreditation(
      {
        actorId: STAFF_ID,
        doctorId: "d1",
        providerId: "p1",
        status: "active",
        validFrom: "2026-01-01",
        validUntil: null,
      },
      store,
    );
    expect(store.saveAccreditation).toHaveBeenCalledWith(expect.objectContaining({ actorId: STAFF_ID, status: "active" }));
  });

  it("updates authorization and coverage together without implying one from the other", async () => {
    const store = fakeStore();
    const result = await updateAppointmentHmo(
      {
        appointmentId: "a1",
        staffId: STAFF_ID,
        authorization: "approved",
        coverage: "pending",
        loaNumber: "LOA-1",
        remarks: null,
      },
      store,
    );
    expect(result).toEqual({ ok: true });
    expect(store.updateAppointmentHmo).toHaveBeenCalledWith(
      expect.objectContaining({ authorization: "approved", coverage: "pending" }),
    );
  });
});

describe("viewBenefitDocument", () => {
  it("audits the view and returns a 60-second signed link", async () => {
    const store = fakeStore();
    const result = await viewBenefitDocument({ kind: "pwd", recordId: PATIENT_ID, staffId: STAFF_ID }, store);
    expect(result).toEqual({ ok: true, url: "https://signed.example/x" });
    expect(store.recordDocumentView).toHaveBeenCalledWith({ kind: "pwd", recordId: PATIENT_ID, staffId: STAFF_ID });
    expect(store.signDocument).toHaveBeenCalledWith("patient/pwd/x.jpg", 60);
  });

  it("does not sign a link when the view is not recorded", async () => {
    const store = fakeStore({
      recordDocumentView: vi.fn(async () => ({ ok: false as const, code: "not_found" })),
    });
    const result = await viewBenefitDocument({ kind: "hmo", recordId: "x", staffId: STAFF_ID }, store);
    expect(result).toEqual({ ok: false, message: "Record not found." });
    expect(store.signDocument).not.toHaveBeenCalled();
  });
});
