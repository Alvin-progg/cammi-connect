import { describe, expect, it } from "vitest";

import { hmoOfferStatus, type HmoAccreditationInput } from "@/lib/benefits/hmo-offer";

const TODAY = "2026-11-22";
const ACTIVE_IN_RANGE: HmoAccreditationInput = {
  status: "active",
  validFrom: "2026-01-01",
  validUntil: null,
};

describe("hmoOfferStatus (spec §6.2 booking scenarios)", () => {
  it("offers HMO when membership is verified and the doctor's accreditation is active and in range", () => {
    expect(
      hmoOfferStatus({ membershipStatus: "verified", accreditation: ACTIVE_IN_RANGE, today: TODAY }),
    ).toEqual({ kind: "offered" });
  });

  it("treats no membership as self-pay", () => {
    expect(
      hmoOfferStatus({ membershipStatus: null, accreditation: ACTIVE_IN_RANGE, today: TODAY }),
    ).toEqual({ kind: "no_membership" });
  });

  it("asks for verification while the membership is pending", () => {
    expect(
      hmoOfferStatus({ membershipStatus: "pending", accreditation: ACTIVE_IN_RANGE, today: TODAY }),
    ).toEqual({ kind: "verification_required" });
  });

  it("refuses HMO payment for a rejected membership", () => {
    expect(
      hmoOfferStatus({ membershipStatus: "rejected", accreditation: ACTIVE_IN_RANGE, today: TODAY }),
    ).toEqual({ kind: "membership_not_usable" });
  });

  it("refuses HMO payment for an expired membership", () => {
    expect(
      hmoOfferStatus({ membershipStatus: "expired", accreditation: ACTIVE_IN_RANGE, today: TODAY }),
    ).toEqual({ kind: "membership_not_usable" });
  });

  it("says the doctor does not accept the HMO when there is no accreditation", () => {
    expect(
      hmoOfferStatus({ membershipStatus: "verified", accreditation: null, today: TODAY }),
    ).toEqual({ kind: "doctor_not_accredited" });
  });

  it.each(["pending", "inactive", "rejected"] as const)(
    "says the doctor does not accept the HMO when accreditation is %s",
    (status) => {
      expect(
        hmoOfferStatus({
          membershipStatus: "verified",
          accreditation: { ...ACTIVE_IN_RANGE, status },
          today: TODAY,
        }),
      ).toEqual({ kind: "doctor_not_accredited" });
    },
  );

  it("does not offer HMO when accreditation has expired by status", () => {
    expect(
      hmoOfferStatus({
        membershipStatus: "verified",
        accreditation: { ...ACTIVE_IN_RANGE, status: "expired" },
        today: TODAY,
      }),
    ).toEqual({ kind: "accreditation_expired" });
  });

  it("does not offer HMO when an active accreditation ended before today", () => {
    expect(
      hmoOfferStatus({
        membershipStatus: "verified",
        accreditation: { ...ACTIVE_IN_RANGE, validUntil: "2026-11-21" },
        today: TODAY,
      }),
    ).toEqual({ kind: "accreditation_expired" });
  });

  it("does not offer HMO before the accreditation starts", () => {
    expect(
      hmoOfferStatus({
        membershipStatus: "verified",
        accreditation: { ...ACTIVE_IN_RANGE, validFrom: "2026-12-01" },
        today: TODAY,
      }),
    ).toEqual({ kind: "accreditation_expired" });
  });

  it("includes the last day of validity", () => {
    expect(
      hmoOfferStatus({
        membershipStatus: "verified",
        accreditation: { ...ACTIVE_IN_RANGE, validUntil: TODAY },
        today: TODAY,
      }),
    ).toEqual({ kind: "offered" });
  });

  it("offers HMO for a service visit (no doctor) on a verified membership alone", () => {
    expect(
      hmoOfferStatus({ membershipStatus: "verified", accreditation: undefined, today: TODAY }),
    ).toEqual({ kind: "offered" });
  });
});
