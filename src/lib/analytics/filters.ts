import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { isValidManilaDate, todayInManila } from "@/lib/appointments/filters";

import type { AnalyticsQuery } from "./period";

export const ANALYTICS_PATH = "/admin/analytics";

export const ANALYTICS_RANGES = ["this_month", "last_3_months", "last_12_months", "custom"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];
type PresetRange = Exclude<AnalyticsRange, "custom">;

export const ANALYTICS_RANGE_LABELS: Record<AnalyticsRange, string> = {
  this_month: "This month",
  last_3_months: "Last 3 months",
  last_12_months: "Last 12 months",
  custom: "Custom",
};

/** Months each preset spans, counting the current month. */
const PRESET_MONTHS: Record<PresetRange, number> = {
  this_month: 1,
  last_3_months: 3,
  last_12_months: 12,
};

/** Longest custom range, so one page load reads a bounded number of appointments. */
const MAX_CUSTOM_MONTHS = 24;

/** Analytics page filters. `from` and `to` are inclusive Manila dates, like the ADM-09 URLs. */
export type AnalyticsFilters = {
  range: AnalyticsRange;
  from: string;
  to: string;
  doctorId: string | null;
  departmentId: string | null;
};

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isPresetRange(value: string | undefined): value is PresetRange {
  return value === "this_month" || value === "last_3_months" || value === "last_12_months";
}

/** Calendar arithmetic on YYYY-MM-DD dates; UTC is used only as a timezone-free calendar. */
function shiftDate(date: string, { months = 0, days = 0 }: { months?: number; days?: number }): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months, value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function presetDates(range: PresetRange, today: string): { from: string; to: string } {
  const monthStart = `${today.slice(0, 7)}-01`;
  return {
    from: shiftDate(monthStart, { months: 1 - PRESET_MONTHS[range] }),
    to: shiftDate(shiftDate(monthStart, { months: 1 }), { days: -1 }),
  };
}

function isValidCustomRange(from: string | undefined, to: string | undefined): boolean {
  if (!from || !to || !isValidManilaDate(from) || !isValidManilaDate(to) || from > to) {
    return false;
  }
  // ISO dates compare correctly as strings.
  return shiftDate(to, { days: 1 }) <= shiftDate(from, { months: MAX_CUSTOM_MONTHS });
}

/**
 * Analytics filters from search params. An explicit preset wins; otherwise
 * valid `from`/`to` dates make a custom range; anything else is this month.
 */
export function parseAnalyticsFilters(
  params: { range?: SearchParam; from?: SearchParam; to?: SearchParam; doctor?: SearchParam; department?: SearchParam },
  now: Date = new Date(),
): AnalyticsFilters {
  const range = firstValue(params.range);
  const from = firstValue(params.from);
  const to = firstValue(params.to);
  const narrowing = {
    doctorId: parseRecordIdParam(params.doctor),
    departmentId: parseRecordIdParam(params.department),
  };

  if (!isPresetRange(range) && isValidCustomRange(from, to) && from && to) {
    return { range: "custom", from, to, ...narrowing };
  }
  const preset = isPresetRange(range) ? range : "this_month";
  return { range: preset, ...presetDates(preset, todayInManila(now)), ...narrowing };
}

/** The metric layer's `[from, to)` query: the inclusive end date becomes the next day. */
export function toAnalyticsQuery(filters: AnalyticsFilters): AnalyticsQuery {
  return {
    from: filters.from,
    to: shiftDate(filters.to, { days: 1 }),
    doctorId: filters.doctorId,
    departmentId: filters.departmentId,
  };
}

/** URL params for the filters. Presets carry no dates, since they follow from today. */
export function analyticsSearchParams(filters: AnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.range === "custom") {
    params.set("range", "custom");
    params.set("from", filters.from);
    params.set("to", filters.to);
  } else if (filters.range !== "this_month") {
    params.set("range", filters.range);
  }
  if (filters.doctorId) params.set("doctor", filters.doctorId);
  if (filters.departmentId) params.set("department", filters.departmentId);
  return params;
}

export function analyticsHref(filters: AnalyticsFilters): string {
  const query = analyticsSearchParams(filters).toString();
  return query ? `${ANALYTICS_PATH}?${query}` : ANALYTICS_PATH;
}
