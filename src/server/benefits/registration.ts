import "server-only";

import { hmoSubmissionSchema, pwdSubmissionSchema } from "@/lib/benefits/schemas";
import { getProfileForAuthUser } from "@/server/profiles/service";

import { checkImage, submitHmoMembership, submitPwdDeclaration, type BenefitsWriteStore } from "./service";

/**
 * Optional PWD and HMO sections of the register form. The inputs are read and
 * validated before sign-up, so a typo never creates an account. They are
 * saved after sign-up; a failure there never blocks the account (the patient
 * adds the details from /account/benefits).
 */

export type RegistrationBenefits = {
  pwd: { idNumber: string; image: Uint8Array } | null;
  hmo: { providerId: string; membershipNumber: string; card: Uint8Array | null } | null;
};

export type RegistrationBenefitsResult = { ok: true; value: RegistrationBenefits } | { ok: false; message: string };

/** An optional upload is absent when the form sends an empty file part. */
export async function readOptionalImage(value: FormDataEntryValue | null): Promise<Uint8Array | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  return new Uint8Array(await value.arrayBuffer());
}

export async function readRegistrationBenefits(formData: FormData): Promise<RegistrationBenefitsResult> {
  let pwd: RegistrationBenefits["pwd"] = null;
  if (formData.get("pwdChoice") === "yes") {
    const parsed = pwdSubmissionSchema.safeParse({ idNumber: formData.get("pwdIdNumber") });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the PWD ID number." };
    const image = await readOptionalImage(formData.get("pwdImage"));
    if (!image) return { ok: false, message: "Add a photo of your PWD ID, or choose No." };
    const check = checkImage(image);
    if ("error" in check) return { ok: false, message: check.error };
    pwd = { idNumber: parsed.data.idNumber, image };
  }

  let hmo: RegistrationBenefits["hmo"] = null;
  if (formData.get("hmoChoice") === "yes") {
    const parsed = hmoSubmissionSchema.safeParse({
      providerId: formData.get("hmoProviderId"),
      membershipNumber: formData.get("hmoMembershipNumber"),
    });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the HMO details." };
    const card = await readOptionalImage(formData.get("hmoCard"));
    if (card) {
      const check = checkImage(card);
      if ("error" in check) return { ok: false, message: check.error };
    }
    hmo = { providerId: parsed.data.providerId, membershipNumber: parsed.data.membershipNumber, card };
  }

  return { ok: true, value: { pwd, hmo } };
}

/**
 * Saves the optional sections for the new patient. Returns the labels that
 * could not be saved. The profile is looked up by the auth user ID from
 * sign-up, so an existing account (whose sign-up looks the same) gets nothing.
 */
export async function saveRegistrationBenefits(
  authUserId: string,
  benefits: RegistrationBenefits,
  store: BenefitsWriteStore,
): Promise<("PWD" | "HMO")[]> {
  if (!benefits.pwd && !benefits.hmo) return [];
  const profile = await getProfileForAuthUser(authUserId);
  if (!profile) return [];

  const failed: ("PWD" | "HMO")[] = [];
  if (benefits.pwd) {
    const result = await submitPwdDeclaration({ patientId: profile.id, ...benefits.pwd }, store);
    if (!result.ok) failed.push("PWD");
  }
  if (benefits.hmo) {
    const result = await submitHmoMembership(
      { patientId: profile.id, ...benefits.hmo },
      store,
    );
    if (!result.ok) failed.push("HMO");
  }
  return failed;
}
