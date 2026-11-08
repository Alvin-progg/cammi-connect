import { manilaDayRange } from "@/lib/appointments/filters";

/**
 * An analytics period and its narrowing filters. `from` and `to` are Manila
 * calendar dates (YYYY-MM-DD) and the period is `[from, to)`: `to` is excluded.
 */
export type AnalyticsQuery = {
  from: string;
  to: string;
  doctorId: string | null;
  departmentId: string | null;
};

/** UTC instants bounding `scheduled_at` for the period; `end` is exclusive. */
export function analyticsPeriodBounds(query: AnalyticsQuery): { start: string; end: string } {
  // manilaDayRange throws a RangeError for a malformed date.
  const start = manilaDayRange(query.from).start;
  const end = manilaDayRange(query.to).start;
  if (end.getTime() <= start.getTime()) {
    throw new RangeError("The analytics period must end after it starts.");
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Every Manila month (YYYY-MM) that has at least one day in the period, in order. */
export function analyticsPeriodMonths(query: AnalyticsQuery): string[] {
  analyticsPeriodBounds(query);
  const lastDay = new Date(`${query.to}T00:00:00Z`);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  const lastMonth = lastDay.toISOString().slice(0, 7);

  const months: string[] = [];
  const cursor = new Date(`${query.from.slice(0, 7)}-01T00:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= lastMonth) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

/** Calendar arithmetic on YYYY-MM-DD dates; UTC is used only as a timezone-free calendar. */
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Every Manila date (YYYY-MM-DD) in the period, in order. */
export function analyticsPeriodDays(query: AnalyticsQuery): string[] {
  analyticsPeriodBounds(query);
  return Array.from({ length: daysBetween(query.from, query.to) }, (_, index) => addDays(query.from, index));
}

/** The equal-length period that ends where this one starts, with the same filters (ADM-12 trend). */
export function previousPeriod(query: AnalyticsQuery): AnalyticsQuery {
  analyticsPeriodBounds(query);
  return { ...query, from: addDays(query.from, -daysBetween(query.from, query.to)), to: query.from };
}
