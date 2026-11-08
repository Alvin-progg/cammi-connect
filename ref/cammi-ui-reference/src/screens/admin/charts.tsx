import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { ANALYTICS } from "@/mock/data";

/*
 * Recharts styling for the redesign (in the repo, keep Recharts imported only
 * by src/components/analytics/analytics-charts.tsx). One axis per chart, 2px
 * lines, 4px rounded bar ends, recessive grid, direct labels, a legend for
 * two or more series, and the same three colours for the same outcome
 * everywhere: completed blue, cancelled amber, no-show violet. Animation is
 * off: motion only confirms a state change (design.md §4.8), charts don't
 * need to grow in.
 */
export const SERIES = {
  primary: "#1a62f2",
  completed: "#1a62f2",
  cancelled: "#b45309",
  noShow: "#7c3aed",
};
const AXIS = { fontSize: 11, fill: "#587093" };
const GRID = "#e3eaf6";
const TOOLTIP = {
  contentStyle: { borderRadius: 10, border: "1px solid #e3eaf6", boxShadow: "0 12px 28px -18px rgb(15 35 66 / .4)", fontSize: 12 },
  cursor: { fill: "rgb(26 98 242 / 0.06)" },
};

/** Card wrapper: title, the one-line takeaway, legend or time frame, chart, table view. */
export function ChartCard({
  id,
  title,
  takeaway,
  aside,
  table,
  children,
  className,
}: {
  id: string;
  title: string;
  takeaway: string;
  aside?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card aria-labelledby={id} className={cn("flex flex-col", className)}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {aside}
      </div>
      <p className="mb-4 min-h-10 text-[13px] text-ink-muted">{takeaway}</p>
      <div className="flex-1">{children}</div>
      {table ? (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer font-medium text-primary">View as table</summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      ) : null}
    </Card>
  );
}

export function ChartLegend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-3.5 text-xs text-ink-secondary">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function MonthlyVolumeChart({ height = 300 }: { height?: number }) {
  return (
    <div role="img" aria-label={`Monthly appointments: ${ANALYTICS.monthly.map((m) => `${m.month} ${m.value}`).join(", ")}`} style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={ANALYTICS.monthly} margin={{ top: 20, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis domain={[60, 200]} ticks={[80, 120, 160, 200]} tick={AXIS} axisLine={false} tickLine={false} width={40} />
          <Tooltip {...TOOLTIP} formatter={(v) => [`${v} appointments`, ""]} />
          <Area isAnimationActive={false} type="linear" dataKey="value" stroke={SERIES.primary} strokeWidth={2} fill={SERIES.primary} fillOpacity={0.07} dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: SERIES.primary }} activeDot={{ r: 6 }}>
            <LabelList dataKey="value" position="top" content={({ x, y, value, index }) => (index === 0 || index === 11 ? <text x={Number(x)} y={Number(y) - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0f2342">{value}</text> : null)} />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ByDoctorChart() {
  return (
    <div role="img" aria-label={`Appointments per doctor: ${ANALYTICS.byDoctor.map((d) => `${d.doctor} ${d.value}`).join(", ")}`} style={{ height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={ANALYTICS.byDoctor} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide domain={[0, 120]} />
          <YAxis type="category" dataKey="doctor" tick={{ ...AXIS, fontSize: 13, fill: "#0f2342" }} axisLine={false} tickLine={false} width={150} />
          <Tooltip {...TOOLTIP} formatter={(v) => [`${v} appointments`, ""]} />
          <Bar isAnimationActive={false} dataKey="value" fill={SERIES.primary} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="value" position="right" fontSize={13} fontWeight={500} fill="#0f2342" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const RAMP = ["#eaf2ff", "#cfe0ff", "#9dbcf8", "#5b8ff5", "#1a62f2", "#1e3a8a"];

/** Heatmap stays plain HTML (as in the repo's peak-heatmap.tsx): single-hue blue ramp. */
export function PeakHeatmap() {
  const { days, slots, values } = ANALYTICS.heatmap;
  const flat = values.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const shade = (v: number) => RAMP[Math.min(RAMP.length - 1, Math.floor(((v - min) / (max - min)) * RAMP.length))];
  return (
    <div>
      <table className="w-full table-fixed border-separate border-spacing-[3px] text-center">
        <caption className="sr-only">Appointments by weekday and time period</caption>
        <colgroup>
          <col className="w-10" />
          {slots.map((s) => <col key={s} />)}
        </colgroup>
        <thead>
          <tr>
            <td />
            {slots.map((s) => (
              <th key={s} scope="col" className="pb-1 text-[11px] font-normal text-ink-muted">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d}>
              <th scope="row" className="w-10 text-left text-[11px] font-normal text-ink-muted">
                {d}
              </th>
              {values[i].map((v, j) => {
                const bg = shade(v);
                const dark = RAMP.indexOf(bg) >= 3;
                return (
                  <td key={j} title={`${d} ${slots[j]}: ${v} appointments`} className="h-13 rounded-md text-[13px] font-medium tabular-nums" style={{ background: bg, color: dark ? "#fff" : "#0f2342" }}>
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div aria-hidden className="mt-3.5 flex items-center gap-2 text-[11px] text-ink-muted">
        {min}
        <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(90deg, ${RAMP[0]}, ${RAMP[2]}, ${RAMP[4]}, ${RAMP[5]})` }} />
        {max}
      </div>
    </div>
  );
}

export function OutcomesChart() {
  const data = ANALYTICS.outcomes.map((o) => ({ ...o, total: o.completed + o.cancelled + o.noShow }));
  return (
    <div role="img" aria-label={`Outcomes per month (completed, cancelled, no-show): ${data.map((d) => `${d.month} ${d.completed}, ${d.cancelled}, ${d.noShow}`).join("; ")}`} style={{ height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis ticks={[0, 35, 70, 105, 140]} domain={[0, 140]} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} />
          {/* 2px surface gap between stacked segments */}
          <Bar isAnimationActive={false} dataKey="completed" name="Completed" stackId="o" fill={SERIES.completed} stroke="#fff" strokeWidth={2} />
          <Bar isAnimationActive={false} dataKey="cancelled" name="Cancelled" stackId="o" fill={SERIES.cancelled} stroke="#fff" strokeWidth={2} />
          <Bar isAnimationActive={false} dataKey="noShow" name="No-show" stackId="o" fill={SERIES.noShow} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="total" position="top" fontSize={11} fontWeight={500} fill="#0f2342" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RatesChart({ data, label }: { data: { label: string; cancelled: number; noShow: number }[]; label: string }) {
  return (
    <div role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.cancelled}% cancelled, ${d.noShow}% no-show`).join("; ")}`} style={{ height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 22, right: 8, left: -12, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
          <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} tickFormatter={(v) => `${v}%`} tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} formatter={(v) => `${v}%`} />
          <Bar isAnimationActive={false} dataKey="cancelled" name="Cancellation rate" fill={SERIES.cancelled} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="cancelled" position="top" formatter={(v) => `${v}%`} fontSize={11} fill="#0f2342" />
          </Bar>
          <Bar isAnimationActive={false} dataKey="noShow" name="No-show rate" fill={SERIES.noShow} radius={[4, 4, 0, 0]}>
            <LabelList dataKey="noShow" position="top" formatter={(v) => `${v}%`} fontSize={11} fill="#0f2342" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small two-series daily chart for the admin dashboard. */
export function DailyActivityChart() {
  const data = ["Nov 1", "Nov 2", "Nov 3", "Nov 4", "Nov 5", "Nov 6", "Nov 7"].map((day, i) => ({
    day,
    requested: [16, 22, 19, 25, 21, 27, 12][i],
    completed: [12, 17, 15, 20, 18, 21, 4][i],
  }));
  return (
    <div role="img" aria-label="Requests and completed visits per day, Nov 1 to Nov 7" style={{ height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={{ display: "none" }} />
          <Bar isAnimationActive={false} dataKey="requested" name="Requests" fill="#9dbcf8" radius={[4, 4, 0, 0]} />
          <Bar isAnimationActive={false} dataKey="completed" name="Completed" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
