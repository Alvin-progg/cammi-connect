/**
 * Appointment requirements (spec §11): what a patient must bring or do before
 * a service or a specialty visit. A requirement attaches to exactly one service
 * or one specialty. It only states what is required; whether a patient met it
 * stays with the front desk.
 */
export const REQUIREMENT_STATUSES = ["draft", "published", "archived"] as const;

export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const REQUIREMENT_TARGET_KINDS = ["service", "specialty"] as const;

export type RequirementTargetKind = (typeof REQUIREMENT_TARGET_KINDS)[number];

export const REQUIREMENT_TARGET_KIND_LABELS: Record<RequirementTargetKind, string> = {
  service: "Service",
  specialty: "Specialty",
};

/** The service or specialty a requirement belongs to. */
export type RequirementTarget = {
  kind: RequirementTargetKind;
  id: string;
  name: string | null;
};

export type AppointmentRequirement = {
  id: string;
  title: string;
  description: string | null;
  target: RequirementTarget;
  isMandatory: boolean;
  /** Manila calendar dates, "YYYY-MM-DD". */
  effectiveFrom: string;
  effectiveTo: string | null;
  status: RequirementStatus;
  /** The newer version created by Supersede, if any. */
  supersededBy: string | null;
};

export type RequirementStatusFilter = "all" | RequirementStatus;
export type RequirementKindFilter = "all" | RequirementTargetKind;
