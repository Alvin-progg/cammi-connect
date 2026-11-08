/**
 * Wording and number formatting for the analytics page (ADM-11). The KPI
 * definitions restate docs/analytics-definitions.md; keep them in sync.
 */

export const KPI_DEFINITIONS = {
  total: "Appointments scheduled in the period, excluding rejected requests.",
  completion:
    "Completed visits ÷ finished visits. Finished visits were scheduled in the period, have already ended, and were completed, cancelled, or missed.",
  cancellationNoShow: "Cancellations ÷ finished visits, and no-shows ÷ finished visits.",
  peakSlot:
    "The weekday and two-hour daytime slot (9 AM–5 PM, Manila) with the most appointments in the period.",
} as const;

/** Rates over fewer finished visits than this get a small-sample note. */
export const SMALL_SAMPLE_SIZE = 10;

export const SMALL_SAMPLE_NOTE = "Rates based on few appointments.";
export const NO_VOLUME_MESSAGE = "No appointments were scheduled in this period.";
export const NO_OUTCOME_MESSAGE = "No visits in this period have finished yet.";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Oct 2026" for "2026-10". */
export function formatMonth(month: string): string {
  return MONTH_FORMATTER.format(new Date(`${month}-01T00:00:00Z`));
}

/** "12.50%", or an em dash when the rate has no denominator. */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toFixed(2)}%`;
}

export function isSmallSample(outcomeCount: number): boolean {
  return outcomeCount > 0 && outcomeCount < SMALL_SAMPLE_SIZE;
}

const SHORT_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** "Jan–Jun", "Nov", or "Dec 2025–Jan 2026" across a year boundary. */
export function formatMonthRange(first: string, last: string): string {
  const short = (month: string) => SHORT_MONTH_FORMATTER.format(new Date(`${month}-01T00:00:00Z`));
  if (first === last) return short(first);
  if (first.slice(0, 4) !== last.slice(0, 4)) return `${formatMonth(first)}–${formatMonth(last)}`;
  return `${short(first)}–${short(last)}`;
}

const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "Nov 2" for "2026-11-02". */
export function formatDay(date: string): string {
  return DAY_FORMATTER.format(new Date(`${date}T00:00:00Z`));
}

/** "▲ 12.50% vs previous period" for the ADM-12 trend. */
export function formatTrend(percent: number | null): string {
  if (percent === null) return "No previous data to compare";
  if (percent === 0) return "No change vs previous period";
  return `${percent > 0 ? "▲" : "▼"} ${Math.abs(percent).toFixed(2)}% vs previous period`;
}
