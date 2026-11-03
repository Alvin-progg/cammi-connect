import type { DoctorStatusFilter, DoctorTab } from "./types";

const STATUS_FILTERS: readonly DoctorStatusFilter[] = ["all", "active", "inactive"];
const TABS: readonly DoctorTab[] = ["profile", "schedule", "appointments"];

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The doctors list `?status=` filter; anything unknown shows every doctor. */
export function parseDoctorStatusFilter(value: string | string[] | undefined): DoctorStatusFilter {
  const raw = firstValue(value);
  return STATUS_FILTERS.find((filter) => filter === raw) ?? "all";
}

/** The doctor detail `?tab=`; anything unknown opens the profile. */
export function parseDoctorTab(value: string | string[] | undefined): DoctorTab {
  const raw = firstValue(value);
  return TABS.find((tab) => tab === raw) ?? "profile";
}
