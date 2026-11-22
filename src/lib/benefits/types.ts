/** BEN-01 status vocabularies, matching the CHECK constraints in 0041. */

export const VERIFICATION_STATUSES = ["pending", "verified", "rejected", "expired"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ACCREDITATION_STATUSES = ["pending", "active", "inactive", "expired", "rejected"] as const;
export type AccreditationStatus = (typeof ACCREDITATION_STATUSES)[number];

export const AUTHORIZATION_STATUSES = ["not_required", "pending", "approved", "rejected", "expired"] as const;
export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

export const COVERAGE_STATUSES = ["pending", "covered", "partially_covered", "not_covered"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];
