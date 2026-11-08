import { z } from "zod";

import { isValidCustomRange, shiftDate } from "@/lib/analytics/filters";
import type { AnalyticsQuery } from "@/lib/analytics/period";
import { todayInManila } from "@/lib/appointments/filters";

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A UUID search param (doctor, department, specialty), or null when absent or malformed. */
export function parseRecordIdParam(
  value: string | string[] | undefined,
): string | null {
  const parsed = z.uuid().safeParse(firstValue(value));
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Admin dashboard filters (spec-admin ADM-12). No status filter: the cards are
// already one status each, and status narrowing happens on /admin/appointments.
// ---------------------------------------------------------------------------

export const DASHBOARD_PATH = "/admin";

export const DASHBOARD_RANGES = ["today", "this_week", "this_month", "custom"] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
type PresetRange = Exclude<DashboardRange, "custom">;

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
  custom: "Custom",
};

/** `from` and `to` are inclusive Manila dates, like the ADM-09 and ADM-11 URLs. */
export type DashboardFilters = {
  range: DashboardRange;
  from: string;
  to: string;
  doctorId: string | null;
  departmentId: string | null;
};

function isPresetRange(value: string | undefined): value is PresetRange {
  return value === "today" || value === "this_week" || value === "this_month";
}

function presetDates(range: PresetRange, today: string): { from: string; to: string } {
  if (range === "today") {
    return { from: today, to: today };
  }
  if (range === "this_week") {
    // getUTCDay on a bare date is its calendar weekday; Sunday is 0, and weeks start Monday.
    const daysSinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    const monday = shiftDate(today, { days: -daysSinceMonday });
    return { from: monday, to: shiftDate(monday, { days: 6 }) };
  }
  const monthStart = `${today.slice(0, 7)}-01`;
  return { from: monthStart, to: shiftDate(shiftDate(monthStart, { months: 1 }), { days: -1 }) };
}

/**
 * Dashboard filters from search params. An explicit preset wins; otherwise
 * valid `from`/`to` dates make a custom range; anything else is this month.
 */
export function parseDashboardFilters(
  params: { range?: SearchParam; from?: SearchParam; to?: SearchParam; doctor?: SearchParam; department?: SearchParam },
  now: Date = new Date(),
): DashboardFilters {
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
export function toDashboardQuery(filters: DashboardFilters): AnalyticsQuery {
  return {
    from: filters.from,
    to: shiftDate(filters.to, { days: 1 }),
    doctorId: filters.doctorId,
    departmentId: filters.departmentId,
  };
}

/** The dashboard URL. Presets carry no dates, since they follow from today. */
export function dashboardHref(filters: DashboardFilters): string {
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
  const query = params.toString();
  return query ? `${DASHBOARD_PATH}?${query}` : DASHBOARD_PATH;
}
