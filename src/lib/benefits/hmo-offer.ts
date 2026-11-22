/**
 * Whether a patient's saved HMO membership can be offered for a doctor's visit
 * (spec §6.2). Pure: the caller passes the membership status, the doctor's
 * accreditation for that HMO (or null), and today's date in Asia/Manila as
 * YYYY-MM-DD. Dates compare as strings, which is valid for that format.
 */

export type MembershipStatus = "not_submitted" | "pending" | "verified" | "rejected" | "expired";

export type AccreditationStatus = "pending" | "active" | "inactive" | "expired" | "rejected";

export type HmoAccreditationInput = {
  status: AccreditationStatus;
  validFrom: string;
  /** null means open-ended. */
  validUntil: string | null;
};

export type HmoOfferStatus =
  | { kind: "offered" }
  | { kind: "no_membership" }
  | { kind: "verification_required" }
  | { kind: "membership_not_usable" }
  | { kind: "doctor_not_accredited" }
  | { kind: "accreditation_expired" };

/**
 * `accreditation` is undefined for a service visit: no doctor, so only the
 * membership is checked. null means the doctor has no accreditation record.
 */
export function hmoOfferStatus(input: {
  membershipStatus: MembershipStatus | null;
  accreditation: HmoAccreditationInput | null | undefined;
  today: string;
}): HmoOfferStatus {
  const { membershipStatus, accreditation, today } = input;

  if (membershipStatus === null || membershipStatus === "not_submitted") {
    return { kind: "no_membership" };
  }
  if (membershipStatus === "pending") {
    return { kind: "verification_required" };
  }
  if (membershipStatus !== "verified") {
    return { kind: "membership_not_usable" };
  }
  if (accreditation === undefined) {
    return { kind: "offered" };
  }
  if (accreditation === null) {
    return { kind: "doctor_not_accredited" };
  }
  if (accreditation.status === "expired") {
    return { kind: "accreditation_expired" };
  }
  if (accreditation.status !== "active") {
    return { kind: "doctor_not_accredited" };
  }
  const started = accreditation.validFrom <= today;
  const notEnded = accreditation.validUntil === null || today <= accreditation.validUntil;
  return started && notEnded ? { kind: "offered" } : { kind: "accreditation_expired" };
}
