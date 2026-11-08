import { HOUR_BUCKETS, WEEKDAYS, type HeatmapCell } from "@/lib/analytics/metrics";

/**
 * Single-hue blue ramp (reference): light to dark in six steps. The darkest
 * three steps take white text so every count stays readable.
 */
const RAMP = ["#eaf2ff", "#cfe0ff", "#9dbcf8", "#5b8ff5", "#1a62f2", "#1e3a8a"] as const;
const FIRST_DARK_STEP = 3;

function rampStep(count: number, min: number, max: number): number {
  if (max === min) return count > 0 ? RAMP.length - 1 : 0;
  return Math.min(RAMP.length - 1, Math.floor(((count - min) / (max - min)) * RAMP.length));
}

/**
 * Weekday × two-hour heatmap as a real table (Recharts has no heatmap), so it
 * is its own accessible alternative. Cells print their count; the tint only
 * reinforces it. Weekdays and time buckets with no appointments are left out.
 */
export function PeakHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const countAt = new Map(cells.map((cell) => [`${cell.weekday} ${cell.hourBucket}`, cell.count]));
  const count = (weekday: string, bucket: string) => countAt.get(`${weekday} ${bucket}`) ?? 0;
  const buckets = HOUR_BUCKETS.filter((bucket) => WEEKDAYS.some((weekday) => count(weekday, bucket) > 0));
  const weekdays = WEEKDAYS.filter((weekday) => buckets.some((bucket) => count(weekday, bucket) > 0));
  const shown = weekdays.flatMap((weekday) => buckets.map((bucket) => count(weekday, bucket)));
  const min = Math.min(...shown);
  const max = Math.max(...shown);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] table-fixed border-separate border-spacing-[3px] text-center">
          <caption className="sr-only">Peak days and times</caption>
          <colgroup>
            <col className="w-12" />
            {buckets.map((bucket) => (
              <col key={bucket} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <td />
              {buckets.map((bucket) => (
                <th key={bucket} scope="col" className="pb-1 text-[11px] font-normal text-ink-muted">
                  {bucket}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((weekday) => (
              <tr key={weekday}>
                <th scope="row" className="text-left text-[11px] font-normal text-ink-muted">
                  {weekday}
                </th>
                {buckets.map((bucket) => {
                  const value = count(weekday, bucket);
                  const step = rampStep(value, min, max);
                  return (
                    <td
                      key={bucket}
                      className="h-13 rounded-md text-[13px] font-medium tabular-nums"
                      style={{ background: RAMP[step], color: step >= FIRST_DARK_STEP ? "#ffffff" : "var(--ink)" }}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-hidden="true" className="mt-3.5 flex items-center gap-2 text-[11px] text-ink-muted">
        {min}
        <span
          className="h-2 flex-1 rounded-full"
          style={{ background: `linear-gradient(90deg, ${RAMP[0]}, ${RAMP[2]}, ${RAMP[4]}, ${RAMP[5]})` }}
        />
        {max}
      </div>
    </div>
  );
}
