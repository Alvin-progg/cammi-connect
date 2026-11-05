import type { ServiceStatusFilter } from "./types";

const STATUS_FILTERS: readonly ServiceStatusFilter[] = ["all", "active", "inactive"];

/** The services list `?status=` filter; anything unknown shows every service. */
export function parseServiceStatusFilter(
  value: string | string[] | undefined,
): ServiceStatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return STATUS_FILTERS.find((filter) => filter === raw) ?? "all";
}
