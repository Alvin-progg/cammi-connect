import type { AnalyticsDatasets, DoctorAnalytics, HeatmapCell, MonthlyOutcomes, MonthlyVolume, WeekdayRates } from "./metrics";
import {
  FALLING_RATIO,
  GROWING_RATIO,
  HIGH_MISSED_SHARE,
  MIN_DOCTOR_APPOINTMENTS,
  MIN_DOCTORS,
  MIN_FINISHED_VISITS,
  MIN_HEATMAP_TOTAL,
  MIN_VOLUME_MONTHS,
  MIN_VOLUME_TOTAL,
  MODERATE_MISSED_SHARE,
  RUSH_HOUR_RATIO,
  SOMEWHAT_UNEVEN_RATIO,
  STANDS_OUT_RATIO,
  UNEVEN_RATIO,
} from "./interpretation-thresholds";
import { LONG_MONTH, WEEKDAY_NAMES, monthDate } from "./takeaways";

/**
 * ADM-17: what each analytics chart means, in a few words (definitions v3 in
 * docs/analytics-definitions.md). Fixed thresholds and templates over the
 * chart's own dataset, never an LLM: the same data always gives the same
 * words. Lines say what the numbers mean, never why, and are null when the
 * data is below the chart's minimum.
 */

export type Severity = "alert" | "watch" | "ok";

export type Interpretation = {
  severity: Severity;
  /** The "What it means" line under the chart (≤ 12 words). */
  text: string;
  /** The same meaning for the Summary card, after the chart's label. */
  point: string;
};

/** Interpreted charts in page order, with their Summary card labels. Ids are the chart anchors. */
export const INTERPRETED_CHARTS = [
  { id: "monthly-volume", label: "Volume" },
  { id: "doctor-volume", label: "Doctors" },
  { id: "peak-times", label: "Peak times" },
  { id: "outcomes", label: "Outcomes" },
  { id: "weekday-rates", label: "Weekdays" },
  { id: "doctor-rates", label: "Doctor rates" },
] as const;

export type InterpretedChartId = (typeof INTERPRETED_CHARTS)[number]["id"];
export type Interpretations = Record<InterpretedChartId, Interpretation | null>;

export const NOT_ENOUGH_DATA_MESSAGE = "Not enough data yet to interpret.";

function sentence(severity: Severity, text: string, point: string): Interpretation {
  return { severity, text, point };
}

export function monthlyInterpretation(monthly: MonthlyVolume[]): Interpretation | null {
  const withData = monthly.filter((month) => month.total > 0);
  const total = withData.reduce((sum, month) => sum + month.total, 0);
  if (withData.length < MIN_VOLUME_MONTHS || total < MIN_VOLUME_TOTAL) return null;

  const first = withData[0];
  const ratio = withData[withData.length - 1].total / first.total;
  if (ratio >= GROWING_RATIO) {
    return sentence("watch", "Demand is growing; watch doctor capacity.", "demand is growing; watch doctor capacity.");
  }
  if (ratio <= FALLING_RATIO) {
    const month = LONG_MONTH.format(monthDate(first.month));
    return sentence("alert", `Demand is falling compared with ${month}.`, `demand is falling compared with ${month}.`);
  }
  return sentence("ok", "Demand is steady.", "demand is steady.");
}

export function doctorLoadInterpretation(doctors: DoctorAnalytics[]): Interpretation | null {
  // `byDoctor` is busiest first.
  const compared = doctors.filter((doctor) => doctor.total >= MIN_DOCTOR_APPOINTMENTS);
  if (compared.length < MIN_DOCTORS) return null;

  const busiest = compared[0];
  const ratio = busiest.total / compared[compared.length - 1].total;
  if (ratio >= UNEVEN_RATIO) {
    return sentence(
      "alert",
      `Workload is uneven; ${busiest.doctorName} is carrying the most.`,
      `workload is uneven; ${busiest.doctorName} carries the most.`,
    );
  }
  if (ratio >= SOMEWHAT_UNEVEN_RATIO) {
    return sentence("watch", "Workload is somewhat uneven.", "workload is somewhat uneven.");
  }
  return sentence("ok", "Workload is balanced across doctors.", "workload is balanced across doctors.");
}

export function heatmapInterpretation(cells: HeatmapCell[]): Interpretation | null {
  const total = cells.reduce((sum, cell) => sum + cell.count, 0);
  if (total < MIN_HEATMAP_TOTAL) return null;

  // Ties go to the earliest weekday, then slot, as cells are ordered.
  const peak = cells.reduce((best, cell) => (cell.count > best.count ? cell : best));
  // peak ÷ (total ÷ cells) as one division, so the boundary compares exactly.
  if ((peak.count * cells.length) / total >= RUSH_HOUR_RATIO) {
    const text = `${WEEKDAY_NAMES[peak.weekday]} ${peak.slot} is the clear rush hour.`;
    return sentence("watch", text, text);
  }
  return sentence(
    "ok",
    "Visits are spread fairly evenly through the week.",
    "visits are spread fairly evenly through the week.",
  );
}

export function outcomesInterpretation(outcomes: MonthlyOutcomes[]): Interpretation | null {
  const finished = outcomes.reduce((sum, month) => sum + month.completed + month.cancelled + month.noShow, 0);
  if (finished < MIN_FINISHED_VISITS) return null;

  const share = outcomes.reduce((sum, month) => sum + month.cancelled + month.noShow, 0) / finished;
  if (share >= HIGH_MISSED_SHARE) {
    const oneIn = Math.round(1 / share);
    return sentence("alert", `High: about 1 in ${oneIn} visits is lost.`, `about 1 in ${oneIn} visits is lost.`);
  }
  if (share >= MODERATE_MISSED_SHARE) {
    return sentence("watch", "Moderate share of visits lost.", "a moderate share of visits is lost.");
  }
  return sentence("ok", "Low: most patients show up.", "most patients show up.");
}

type MissedGroup<T> = { item: T; finished: number; missed: number };

/**
 * The group whose missed rate is at least STANDS_OUT_RATIO × the period's
 * average missed rate (all of the groups' finished visits), or null. Missed
 * counts come back from the rounded rates; `finished` is too small for that
 * rounding to change a count.
 */
function standsOut<T>(
  items: T[],
  rates: (item: T) => { outcomeCount: number; cancellationRate: number | null; noShowRate: number | null },
): { finished: number; worst: T | null } {
  const groups: MissedGroup<T>[] = items.map((item) => {
    const { outcomeCount, cancellationRate, noShowRate } = rates(item);
    return {
      item,
      finished: outcomeCount,
      missed: Math.round((((cancellationRate ?? 0) + (noShowRate ?? 0)) * outcomeCount) / 100),
    };
  });
  const finished = groups.reduce((sum, group) => sum + group.finished, 0);
  const missed = groups.reduce((sum, group) => sum + group.missed, 0);
  const rated = groups.filter((group) => group.finished > 0);
  if (missed === 0 || rated.length === 0) return { finished, worst: null };

  // Highest missed rate; ties go to the earlier group.
  const worst = rated.reduce((best, group) =>
    group.missed * best.finished > best.missed * group.finished ? group : best,
  );
  // (worst.missed ÷ worst.finished) ÷ (missed ÷ finished) as one division, so the boundary compares exactly.
  const ratio = (worst.missed * finished) / (missed * worst.finished);
  return { finished, worst: ratio >= STANDS_OUT_RATIO ? worst.item : null };
}

export function weekdayRatesInterpretation(rates: WeekdayRates[]): Interpretation | null {
  const { finished, worst } = standsOut(rates, (day) => day);
  if (finished < MIN_FINISHED_VISITS) return null;
  if (worst) {
    const text = `${WEEKDAY_NAMES[worst.weekday]}s lose the most visits; reminders matter most then.`;
    return sentence("alert", text, text);
  }
  return sentence("ok", "No weekday stands out for missed visits.", "no weekday stands out for missed visits.");
}

export function doctorRatesInterpretation(doctors: DoctorAnalytics[]): Interpretation | null {
  const { finished, worst } = standsOut(doctors, (doctor) => doctor);
  if (finished < MIN_FINISHED_VISITS) return null;
  if (worst) {
    const text = `${worst.doctorName}'s patients miss visits most often.`;
    return sentence("alert", text, text);
  }
  return sentence("ok", "Missed visits are similar across doctors.", "missed visits are similar across doctors.");
}

export function interpretAnalytics(
  data: Pick<AnalyticsDatasets, "monthly" | "byDoctor" | "heatmap" | "outcomesByMonth" | "ratesByWeekday">,
): Interpretations {
  return {
    "monthly-volume": monthlyInterpretation(data.monthly),
    "doctor-volume": doctorLoadInterpretation(data.byDoctor),
    "peak-times": heatmapInterpretation(data.heatmap.cells),
    outcomes: outcomesInterpretation(data.outcomesByMonth),
    "weekday-rates": weekdayRatesInterpretation(data.ratesByWeekday),
    "doctor-rates": doctorRatesInterpretation(data.byDoctor),
  };
}

