import { HOUR_BUCKETS, WEEKDAYS, type HeatmapCell } from "@/lib/analytics/metrics";

/** Tint range: the faintest non-zero cell stays visible, the strongest keeps body text readable in both themes. */
const MIN_TINT_PERCENT = 8;
const MAX_TINT_PERCENT = 45;

/**
 * Weekday × two-hour heatmap as a real table (Recharts has no heatmap), so it
 * is its own accessible alternative. Cells print their count; the single-hue
 * tint only reinforces it. Hour rows with no appointments are left out.
 */
export function PeakHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const countAt = new Map(cells.map((cell) => [`${cell.weekday} ${cell.hourBucket}`, cell.count]));
  const max = Math.max(0, ...cells.map((cell) => cell.count));
  const hourRows = HOUR_BUCKETS.filter((bucket) =>
    WEEKDAYS.some((weekday) => (countAt.get(`${weekday} ${bucket}`) ?? 0) > 0),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Peak days and times</caption>
        <thead>
          <tr>
            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-ink-muted">
              Time (Manila)
            </th>
            {WEEKDAYS.map((weekday) => (
              <th key={weekday} scope="col" className="px-2 py-1 text-center text-xs font-medium text-ink-muted">
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hourRows.map((bucket) => (
            <tr key={bucket}>
              <th scope="row" className="whitespace-nowrap px-2 py-1 text-left text-xs font-medium text-ink-secondary">
                {bucket}
              </th>
              {WEEKDAYS.map((weekday) => {
                const count = countAt.get(`${weekday} ${bucket}`) ?? 0;
                const tint = MIN_TINT_PERCENT + Math.round((count / max) * (MAX_TINT_PERCENT - MIN_TINT_PERCENT));
                return (
                  <td
                    key={weekday}
                    className={`rounded-md px-2 py-2 text-center tabular-nums ${count > 0 ? "font-semibold text-ink" : "text-ink-muted"}`}
                    style={
                      count > 0
                        ? { backgroundColor: `color-mix(in oklab, var(--chart-1) ${tint}%, var(--surface))` }
                        : undefined
                    }
                  >
                    {count}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
