import { parseRecordIdParam } from "@/lib/admin/dashboard";

import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_TARGET_KINDS,
  type RequirementKindFilter,
  type RequirementStatusFilter,
} from "./types";

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The requirements list `?status=` filter; anything unknown shows all. */
export function parseRequirementStatusFilter(value: SearchParam): RequirementStatusFilter {
  const raw = firstValue(value);
  return REQUIREMENT_STATUSES.find((status) => status === raw) ?? "all";
}

/** The requirements list `?kind=` filter (service or specialty). */
export function parseRequirementKindFilter(value: SearchParam): RequirementKindFilter {
  const raw = firstValue(value);
  return REQUIREMENT_TARGET_KINDS.find((kind) => kind === raw) ?? "all";
}

/**
 * The "Applies to" value for a new requirement opened from a service or
 * specialty page (`?service=<id>` or `?specialty=<id>`), or null.
 */
export function parseRequirementTargetParam(params: {
  service?: SearchParam;
  specialty?: SearchParam;
}): string | null {
  const serviceId = parseRecordIdParam(params.service);
  if (serviceId) {
    return `service:${serviceId}`;
  }
  const specialtyId = parseRecordIdParam(params.specialty);
  return specialtyId ? `specialty:${specialtyId}` : null;
}
