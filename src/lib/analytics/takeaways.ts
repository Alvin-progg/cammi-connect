import type { DoctorAnalytics, HeatmapCell, MonthlyOutcomes, MonthlyVolume, Weekday, WeekdayRates } from "./metrics";

/**
 * One-line takeaways under each analytics chart (reference design). Every
 * sentence states measured facts from the chart's own data, never a cause,
 * and is null when the data is too thin to say anything.
 */

const LONG_MONTH = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });
const SHORT_MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const WEEKDAY_NAMES: Record<Weekday, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00Z`);
}

/** "A", "A and B", "A, B and C". */
function joinList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function percent(value: number | null): string {
  return `${Math.round(value ?? 0)}%`;
}

export function monthlyTakeaway(monthly: MonthlyVolume[]): string | null {
  const firstIndex = monthly.findIndex((month) => month.total > 0);
  const lastIndex = monthly.findLastIndex((month) => month.total > 0);
  if (firstIndex === -1 || lastIndex <= firstIndex) return null;

  const first = monthly[firstIndex];
  const last = monthly[lastIndex];
  const ratio = last.total / first.total;
  const change =
    ratio > 2 ? "more than doubled" : ratio === 2 ? "doubled" : ratio > 1 ? "rose" : ratio < 1 ? "fell" : "held steady";
  const dips = monthly
    .slice(firstIndex + 1, lastIndex + 1)
    .filter((month, index) => month.total < monthly[firstIndex + index].total)
    .map((month) => SHORT_MONTH.format(monthDate(month.month)));
  const sentence = `Volume ${change} from ${LONG_MONTH.format(monthDate(first.month))} (${first.total}) to ${LONG_MONTH.format(monthDate(last.month))} (${last.total})`;
  // A falling or flat series has dips by definition; they are only news on the way up.
  return ratio > 1 && dips.length > 0 ? `${sentence}, with small dips in ${joinList(dips)}.` : `${sentence}.`;
}

export function doctorTakeaway(doctors: DoctorAnalytics[]): string | null {
  if (doctors.length < 2) return null;
  const busiest = doctors[0];
  const quietest = doctors[doctors.length - 1];
  if (quietest.total === 0) return null;
  const ratio = Math.round((busiest.total / quietest.total) * 10) / 10;
  return ratio <= 1.1
    ? "Appointments are spread about evenly across doctors."
    : `${busiest.doctorName} carries ${ratio}× the load of ${quietest.doctorName}.`;
}

export function heatmapTakeaway(cells: HeatmapCell[]): string | null {
  const peak = cells.reduce<HeatmapCell | null>((best, cell) => (!best || cell.count > best.count ? cell : best), null);
  const quiet = cells.reduce<HeatmapCell | null>((best, cell) => (!best || cell.count < best.count ? cell : best), null);
  if (!peak || !quiet || peak.count === 0) return null;
  return `${WEEKDAY_NAMES[peak.weekday]} ${peak.slot} peaks at ${peak.count}; ${WEEKDAY_NAMES[quiet.weekday]} ${quiet.slot} is quietest (${quiet.count}).`;
}

export function outcomesTakeaway(outcomes: MonthlyOutcomes[]): string | null {
  const all = outcomes.reduce((sum, month) => sum + month.completed + month.cancelled + month.noShow, 0);
  if (all === 0) return null;
  const missed = outcomes.reduce((sum, month) => sum + month.cancelled + month.noShow, 0);
  const share = `cancellations and no-shows were ${Math.round((missed / all) * 100)}% of outcomes.`;
  if (outcomes.length < 2) return `${share.charAt(0).toUpperCase()}${share.slice(1)}`;
  return `Completed visits went from ${outcomes[0].completed} to ${outcomes[outcomes.length - 1].completed}; ${share}`;
}

export function weekdayRatesTakeaway(rates: WeekdayRates[]): string | null {
  const worst = rates.reduce<WeekdayRates | null>(
    (best, day) =>
      !best || (day.cancellationRate ?? 0) + (day.noShowRate ?? 0) > (best.cancellationRate ?? 0) + (best.noShowRate ?? 0)
        ? day
        : best,
    null,
  );
  if (!worst) return null;
  return `${WEEKDAY_NAMES[worst.weekday]} is highest: ${percent(worst.cancellationRate)} cancelled, ${percent(worst.noShowRate)} no-show.`;
}

export function doctorRatesTakeaway(doctors: DoctorAnalytics[]): string | null {
  const rated = doctors.filter((doctor) => doctor.cancellationRate !== null && doctor.noShowRate !== null);
  if (rated.length < 2) return null;
  const by = (key: "cancellationRate" | "noShowRate", direction: 1 | -1) =>
    rated.reduce((best, doctor) => (direction * ((doctor[key] ?? 0) - (best[key] ?? 0)) > 0 ? doctor : best));
  const mostCancel = by("cancellationRate", 1);
  const mostMiss = by("noShowRate", 1);
  const leastCancel = by("cancellationRate", -1);
  const leastMiss = by("noShowRate", -1);

  if (mostCancel === mostMiss && leastCancel === leastMiss && mostCancel !== leastCancel) {
    return `${mostCancel.doctorName}'s patients cancel most (${percent(mostCancel.cancellationRate)}) and miss most (${percent(mostMiss.noShowRate)}); ${leastCancel.doctorName}'s least (${percent(leastCancel.cancellationRate)} and ${percent(leastMiss.noShowRate)}).`;
  }
  return `${mostCancel.doctorName}'s patients cancel most (${percent(mostCancel.cancellationRate)}); ${mostMiss.doctorName}'s miss most (${percent(mostMiss.noShowRate)}).`;
}
