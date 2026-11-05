import { VOLUME_STATUSES, type AnalyticsDatasets } from "./metrics";

/**
 * CSV export of the analytics datasets (ADM-11). Rows come straight from the
 * metric layer; no patient identifiers exist in any dataset.
 */

export const ANALYTICS_DATASETS = ["kpis", "monthly", "doctor", "heatmap", "status", "slots"] as const;
export type AnalyticsDataset = (typeof ANALYTICS_DATASETS)[number];

export const ANALYTICS_DATASET_LABELS: Record<AnalyticsDataset, string> = {
  kpis: "Key figures",
  monthly: "Monthly volume",
  doctor: "Per doctor",
  heatmap: "Peak days and times",
  status: "Status by month",
  slots: "Rates by day and time",
};

export function isAnalyticsDataset(value: string): value is AnalyticsDataset {
  return ANALYTICS_DATASETS.some((dataset) => dataset === value);
}

type Cell = string | number | null;

/** Leading characters that make Excel and Sheets evaluate text as a formula. */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

function formatCell(cell: Cell): string {
  if (cell === null) {
    return "";
  }
  if (typeof cell === "number") {
    return String(cell);
  }
  // Doctor names are admin-entered text; a leading apostrophe keeps them inert.
  const text = FORMULA_TRIGGERS.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 CSV with a header row and CRLF line endings. */
export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => `${row.map(formatCell).join(",")}\r\n`).join("");
}

export function analyticsDatasetCsv(dataset: AnalyticsDataset, analytics: AnalyticsDatasets): string {
  switch (dataset) {
    case "kpis": {
      const { kpis } = analytics;
      return toCsv(
        ["metric", "value"],
        [
          ["total_appointments", kpis.total],
          ["due_cohort", kpis.dueCount],
          ["completion_rate_pct", kpis.completionRate],
          ["no_show_rate_pct", kpis.noShowRate],
          ["cancellation_rate_pct", kpis.cancellationRate],
          ["pending_now", kpis.pending],
        ],
      );
    }
    case "monthly":
      return toCsv(
        ["month", "total_appointments"],
        analytics.monthly.map((row) => [row.month, row.total]),
      );
    case "doctor":
      return toCsv(
        ["doctor", "total_appointments", "due_cohort", "cancellation_rate_pct", "no_show_rate_pct"],
        analytics.byDoctor.map((row) => [row.doctorName, row.total, row.dueCount, row.cancellationRate, row.noShowRate]),
      );
    case "heatmap":
      return toCsv(
        ["weekday", "hour_bucket_manila", "total_appointments"],
        analytics.heatmap.map((row) => [row.weekday, row.hourBucket, row.count]),
      );
    case "status":
      return toCsv(
        ["month", ...VOLUME_STATUSES],
        analytics.statusByMonth.map((row) => [row.month, ...VOLUME_STATUSES.map((status) => row.counts[status])]),
      );
    case "slots":
      return toCsv(
        ["weekday", "hour_bucket_manila", "due_cohort", "cancellation_rate_pct", "no_show_rate_pct"],
        analytics.ratesBySlot.map((row) => [row.weekday, row.hourBucket, row.dueCount, row.cancellationRate, row.noShowRate]),
      );
  }
}
