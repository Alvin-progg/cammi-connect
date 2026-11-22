// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/profiles/service", () => ({
  getProfileForAuthUser: vi.fn(async (authUserId: string) =>
    authUserId === "known-auth-user" ? { id: "patient-1", role: "patient", full_name: "Test", is_active: true } : null,
  ),
}));

import { getProfileForAuthUser } from "@/server/profiles/service";
import { readRegistrationBenefits, saveRegistrationBenefits } from "@/server/benefits/registration";
import type { BenefitsWriteStore } from "@/server/benefits/service";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PROVIDER_ID = "11111111-1111-4111-8111-111111111111";

function form(entries: Record<string, string | File>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

function fakeStore(): BenefitsWriteStore {
  return {
    uploadDocument: vi.fn(async () => undefined),
    removeDocument: vi.fn(async () => undefined),
    submitPwd: vi.fn(async () => ({ ok: true as const, value: undefined })),
    submitHmo: vi.fn(async () => ({ ok: true as const, value: "id" })),
    decideBenefit: vi.fn(),
    saveAccreditation: vi.fn(),
    updateAppointmentHmo: vi.fn(),
    recordDocumentView: vi.fn(),
    signDocument: vi.fn(),
  } as unknown as BenefitsWriteStore;
}

describe("readRegistrationBenefits", () => {
  it("reads nothing when both sections are No", async () => {
    const result = await readRegistrationBenefits(form({ pwdChoice: "no", hmoChoice: "no" }));
    expect(result).toEqual({ ok: true, value: { pwd: null, hmo: null } });
  });

  it("refuses a PWD Yes without an ID image, before any account is created", async () => {
    const result = await readRegistrationBenefits(
      form({ pwdChoice: "yes", pwdIdNumber: "PWD-1", pwdImage: new File([], "") }),
    );
    expect(result).toEqual({ ok: false, message: "Add a photo of your PWD ID, or choose No." });
  });

  it("refuses an ID image that is not an accepted image", async () => {
    const result = await readRegistrationBenefits(
      form({ pwdChoice: "yes", pwdIdNumber: "PWD-1", pwdImage: new File(["%PDF-1.4"], "id.pdf") }),
    );
    expect(result).toEqual({ ok: false, message: "Upload a JPEG, PNG, or WebP image." });
  });

  it("reads a valid PWD declaration and HMO membership with an optional card", async () => {
    const result = await readRegistrationBenefits(
      form({
        pwdChoice: "yes",
        pwdIdNumber: " PWD-9 ",
        pwdImage: new File([JPEG], "id.jpg", { type: "image/jpeg" }),
        hmoChoice: "yes",
        hmoProviderId: PROVIDER_ID,
        hmoMembershipNumber: "MX-77",
        hmoCard: new File([], ""),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pwd?.idNumber).toBe("PWD-9");
    expect(result.value.hmo).toEqual({ providerId: PROVIDER_ID, membershipNumber: "MX-77", card: null });
  });
});

describe("saveRegistrationBenefits", () => {
  it("saves nothing when the auth user has no profile yet (existing-account sign-up looks the same)", async () => {
    const store = fakeStore();
    const failed = await saveRegistrationBenefits(
      "unknown-auth-user",
      { pwd: { idNumber: "PWD-1", image: JPEG }, hmo: null },
      store,
    );
    expect(failed).toEqual([]);
    expect(store.submitPwd).not.toHaveBeenCalled();
  });

  it("reports which sections failed without blocking the others", async () => {
    const store = fakeStore();
    vi.mocked(store.submitHmo).mockResolvedValueOnce({ ok: false, code: "provider_inactive" });
    const failed = await saveRegistrationBenefits(
      "known-auth-user",
      {
        pwd: { idNumber: "PWD-1", image: JPEG },
        hmo: { providerId: PROVIDER_ID, membershipNumber: "MX-77", card: null },
      },
      store,
    );
    expect(failed).toEqual(["HMO"]);
    expect(store.submitPwd).toHaveBeenCalledWith(expect.objectContaining({ patientId: "patient-1" }));
    expect(getProfileForAuthUser).toHaveBeenCalledWith("known-auth-user");
  });
});
