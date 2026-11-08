/**
 * Wording and number formatting for the analytics page (ADM-11). The KPI
 * definitions restate docs/analytics-definitions.md; keep them in sync.
 */

export const KPI_DEFINITIONS = {
  total: "Appointments scheduled in the period, excluding rejected requests.",
  completion:
    "Completed visits ÷ due visits. Due visits were confirmed, scheduled in the period, and have already ended (including later cancellations and no-shows).",
  cancellation: "Cancellations after confirmation ÷ due visits.",
  noShow: "No-shows ÷ due visits.",
} as const;

/** Rates over fewer due visits than this get a small-sample note. */
export const SMALL_SAMPLE_SIZE = 10;

export const SMALL_SAMPLE_NOTE = "Rates based on few appointments.";
export const NO_VOLUME_MESSAGE = "No appointments were scheduled in this period.";
export const NO_DUE_MESSAGE = "No visits in this period have reached their scheduled time yet.";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

/** "Oct 2026" for "2026-10". */
export function formatMonth(month: string): string {
  return MONTH_FORMATTER.format(new Date(`${month}-01T00:00:00Z`));
}

/** "12.50%", or an em dash when the rate has no denominator. */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toFixed(2)}%`;
}

export function isSmallSample(dueCount: number): boolean {
  return dueCount > 0 && dueCount < SMALL_SAMPLE_SIZE;
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
