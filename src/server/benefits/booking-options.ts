import "server-only";

import { hmoOfferStatus, type HmoAccreditationInput, type HmoOfferStatus } from "@/lib/benefits/hmo-offer";
import { maskMemberNumber } from "@/lib/billing/hmo";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

/**
 * What chat may offer for this patient's saved memberships (BEN-05). Only
 * database rows are read; the offer decision comes from hmoOfferStatus.
 */

export type HmoBookingOption = {
  patientHmoId: string;
  providerId: string;
  name: string;
  copayCentavos: number;
  maskedNumber: string;
  offer: HmoOfferStatus;
};

/**
 * Memberships at active providers. For a consultation, the doctor's
 * accreditation is checked; for a service visit (doctorId null) it is not.
 */
export async function readHmoBookingOptions(input: {
  patientId: string;
  doctorId: string | null;
  today: string;
}): Promise<HmoBookingOption[]> {
  const client = getSupabaseAdminClient();
  const { data: memberships, error: membershipError } = await client
    .from("patient_hmo")
    .select("id, hmo_provider_id, membership_number, verification_status")
    .eq("patient_id", input.patientId);
  if (membershipError) throw new Error("Unable to load HMO memberships.");
  if (memberships.length === 0) return [];

  const providerIds = memberships.map((row) => row.hmo_provider_id);
  const { data: providers, error: providerError } = await client
    .from("hmo_providers")
    .select("id, name, copay_centavos, is_active")
    .in("id", providerIds);
  if (providerError) throw new Error("Unable to load HMO providers.");

  const accreditationByProvider = new Map<string, HmoAccreditationInput>();
  if (input.doctorId !== null) {
    const { data: accreditations, error: accreditationError } = await client
      .from("doctor_hmo_accreditations")
      .select("hmo_provider_id, status, valid_from, valid_until")
      .eq("doctor_id", input.doctorId)
      .in("hmo_provider_id", providerIds);
    if (accreditationError) throw new Error("Unable to load accreditations.");
    for (const row of accreditations) {
      accreditationByProvider.set(row.hmo_provider_id, {
        status: row.status,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
      });
    }
  }

  const options: HmoBookingOption[] = [];
  for (const membership of memberships) {
    const provider = providers.find((row) => row.id === membership.hmo_provider_id);
    if (!provider?.is_active) continue;

    const accreditation =
      input.doctorId === null ? undefined : (accreditationByProvider.get(membership.hmo_provider_id) ?? null);
    options.push({
      patientHmoId: membership.id,
      providerId: provider.id,
      name: provider.name,
      copayCentavos: provider.copay_centavos,
      maskedNumber: maskMemberNumber(membership.membership_number),
      offer: hmoOfferStatus({
        membershipStatus: membership.verification_status,
        accreditation,
        today: input.today,
      }),
    });
  }
  return options;
}

/** Whether the patient's PWD declaration is verified (the only state that unlocks the PWD discount). */
export async function readPwdVerified(patientId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdminClient()
    .from("patient_pwd")
    .select("verification_status")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (error) throw new Error("Unable to load PWD status.");
  return data?.verification_status === "verified";
}
