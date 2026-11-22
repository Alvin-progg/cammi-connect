import type { AccreditationStatus, AuthorizationStatus, CoverageStatus, VerificationStatus } from "./types";

/** Patient and staff wording for the verification and authorization statuses. */

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  pending: "Waiting for review",
  verified: "Verified",
  rejected: "Rejected",
  expired: "Expired",
};

export const ACCREDITATION_LABELS: Record<AccreditationStatus, string> = {
  pending: "Pending",
  active: "Accepted",
  inactive: "Not accepted",
  expired: "Expired",
  rejected: "Rejected",
};

export const AUTHORIZATION_LABELS: Record<AuthorizationStatus, string> = {
  not_required: "Not required",
  pending: "Pending",
  approved: "Approved (LOA)",
  rejected: "Rejected",
  expired: "Expired",
};

export const COVERAGE_LABELS: Record<CoverageStatus, string> = {
  pending: "Pending",
  covered: "Covered",
  partially_covered: "Partially covered",
  not_covered: "Not covered",
};
