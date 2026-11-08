import type { AnalyticsDatasets } from "./metrics";

/**
 * CSV export of the analytics datasets (ADM-11). Rows come straight from the
 * metric layer; no patient identifiers exist in any dataset.
 */

export const ANALYTICS_DATASETS = ["kpis", "monthly", "doctor", "heatmap", "outcomes", "weekday"] as const;
export type AnalyticsDataset = (typeof ANALYTICS_DATASETS)[number];

export const ANALYTICS_DATASET_LABELS: Record<AnalyticsDataset, string> = {
  kpis: "Key figures",
  monthly: "Monthly volume",
  doctor: "Per doctor",
  heatmap: "Peak days and times",
  outcomes: "Outcomes by month",
  weekday: "Rates by weekday",
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
          ["outcome_cohort", kpis.outcomeCount],
          ["completed", kpis.completed],
          ["cancelled", kpis.cancelled],
          ["no_show", kpis.noShow],
          ["completion_rate_pct", kpis.completionRate],
          ["cancellation_rate_pct", kpis.cancellationRate],
          ["no_show_rate_pct", kpis.noShowRate],
          ["outcome_months", kpis.outcomeMonths ? `${kpis.outcomeMonths.first} to ${kpis.outcomeMonths.last}` : null],
          ["busiest_month", kpis.busiestMonth?.month ?? null],
          ["busiest_month_total", kpis.busiestMonth?.total ?? null],
          ["peak_slot", kpis.peakSlot ? `${kpis.peakSlot.weekday} ${kpis.peakSlot.slot}` : null],
          ["peak_slot_total", kpis.peakSlot?.count ?? null],
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
        ["doctor", "total_appointments", "outcome_cohort", "cancellation_rate_pct", "no_show_rate_pct"],
        analytics.byDoctor.map((row) => [row.doctorName, row.total, row.outcomeCount, row.cancellationRate, row.noShowRate]),
      );
    case "heatmap":
      return toCsv(["weekday", "slot_manila", "total_appointments"], [
        ...analytics.heatmap.cells.map((row): Cell[] => [row.weekday, row.slot, row.count]),
        ["All", "Outside 9 AM–5 PM", analytics.heatmap.outsideHours],
      ]);
    case "outcomes":
      return toCsv(
        ["month", "completed", "cancelled", "no_show"],
        analytics.outcomesByMonth.map((row) => [row.month, row.completed, row.cancelled, row.noShow]),
      );
    case "weekday":
      return toCsv(
        ["weekday", "outcome_cohort", "cancellation_rate_pct", "no_show_rate_pct"],
        analytics.ratesByWeekday.map((row) => [row.weekday, row.outcomeCount, row.cancellationRate, row.noShowRate]),
      );
  }
}
