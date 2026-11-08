"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDay, formatMonth } from "@/lib/analytics/display";
import type {
  DailyVolume,
  DoctorAnalytics,
  MonthlyStatusCounts,
  MonthlyVolume,
  SlotRates,
  VolumeStatus,
} from "@/lib/analytics/metrics";
import { VOLUME_STATUSES } from "@/lib/analytics/metrics";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";

/*
 * The only module that imports Recharts, so the library stays in the
 * analytics route's client bundle. Every value here was computed by the
 * metric layer; these components only draw it. Series carry legend labels
 * and differ by more than hue (design.md §4.6); each chart's data table sits
 * beside it in ChartCard.
 */

// Reference chart styling: recessive axis text, one axis per chart, direct
// labels in ink, 4px rounded bar ends, animation off.
const AXIS_TICK = { fill: "var(--ink-muted)", fontSize: 11 };
const LABEL_FILL = "var(--ink)";
const GRID_STROKE = "var(--line)";
const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  boxShadow: "0 12px 28px -18px rgb(15 35 66 / 0.4)",
  color: "var(--ink)",
  fontSize: 12,
};
const BAR_CURSOR = { fill: "rgb(26 98 242 / 0.06)" };
const CHART_HEIGHT = 288;

export const SERIES = {
  volume: "var(--series-completed)",
  completed: "var(--series-completed)",
  cancelled: "var(--series-cancelled)",
  noShow: "var(--series-noshow)",
  requested: "var(--chart-6)",
  confirmed: "var(--chart-2)",
} as const;

function percentTick(value: number) {
  return `${value}%`;
}

function ChartFrame({ label, height = CHART_HEIGHT, children }: { label: string; height?: number; children: React.ReactElement }) {
  // The chart is a picture of the data table next to it; screen readers use the table.
  return (
    <div role="img" aria-label={label} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyVolumeChart({ data }: { data: MonthlyVolume[] }) {
  const points = data.map((point) => ({ month: formatMonth(point.month), total: point.total }));
  const peak = Math.max(0, ...points.map((point) => point.total));
  // Label the first, last, and busiest months only; the table has every value.
  const labelled = (index: number) =>
    index === 0 || index === points.length - 1 || points[index]?.total === peak;
  return (
    <ChartFrame label="Area chart of appointments per month" height={300}>
      <AreaChart data={points} margin={{ top: 22, right: 16, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} appointments`, ""]} />
        <Area
          type="linear"
          dataKey="total"
          name="Appointments"
          stroke={SERIES.volume}
          strokeWidth={2}
          fill={SERIES.volume}
          fillOpacity={0.07}
          dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: SERIES.volume }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="total"
            content={({ x, y, value, index }) =>
              typeof index === "number" && labelled(index) ? (
                <text x={Number(x)} y={Number(y) - 10} textAnchor="middle" fontSize={12} fontWeight={600} fill={LABEL_FILL}>
                  {String(value)}
                </text>
              ) : null
            }
          />
        </Area>
      </AreaChart>
    </ChartFrame>
  );
}

/** ADM-12: appointments per Manila day. No point labels, since a month has up to 31 points. */
export function DailyActivityChart({ data }: { data: DailyVolume[] }) {
  const points = data.map((point) => ({ day: formatDay(point.date), total: point.total }));
  return (
    <ChartFrame label="Line chart of appointments per day">
      <LineChart data={points} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} minTickGap={16} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line
          type="monotone"
          dataKey="total"
          name="Appointments"
          stroke={SERIES.volume}
          strokeWidth={2}
          dot={data.length <= 14 ? { r: 4, fill: SERIES.volume } : false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

/** ADM-12: appointments by current status. */
export function StatusDistributionChart({ data }: { data: Record<VolumeStatus, number> }) {
  const rows = VOLUME_STATUSES.map((status) => ({
    name: APPOINTMENT_STATUS_LABELS[status],
    total: data[status],
  }));
  return (
    <ChartFrame label="Bar chart of appointments by status" height={rows.length * 40 + 40}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={140} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-muted)" }} />
        <Bar dataKey="total" name="Appointments" fill={SERIES.volume} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="total" position="right" fill="var(--ink-secondary)" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export function DoctorVolumeChart({ data }: { data: DoctorAnalytics[] }) {
  const rows = data.map((doctor) => ({ name: doctor.doctorName, total: doctor.total }));
  return (
    <ChartFrame label="Bar chart of appointments per doctor" height={Math.max(160, rows.length * 50 + 20)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }} barCategoryGap={10}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ ...AXIS_TICK, fontSize: 13, fill: LABEL_FILL }}
          tickLine={false}
          axisLine={false}
          width={150}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} formatter={(value) => [`${value} appointments`, ""]} />
        <Bar dataKey="total" name="Appointments" fill={SERIES.volume} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="total" position="right" fill={LABEL_FILL} fontSize={13} fontWeight={500} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export const OUTCOME_SERIES: { status: VolumeStatus; color: string }[] = [
  { status: "completed", color: SERIES.completed },
  { status: "cancelled", color: SERIES.cancelled },
  { status: "no_show", color: SERIES.noShow },
];
export const OPEN_SERIES: { status: VolumeStatus; color: string }[] = [
  { status: "requested", color: SERIES.requested },
  { status: "confirmed", color: SERIES.confirmed },
];

export function StatusByMonthChart({ data }: { data: MonthlyStatusCounts[] }) {
  const [showOpen, setShowOpen] = useState(false);
  const series = showOpen ? [...OUTCOME_SERIES, ...OPEN_SERIES] : OUTCOME_SERIES;
  const rows = data.map((month) => ({
    month: formatMonth(month.month),
    ...month.counts,
    // Total of the stacked segments shown, printed above each bar.
    shownTotal: series.reduce((sum, { status }) => sum + month.counts[status], 0),
  }));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 self-start text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={showOpen}
          onChange={(event) => setShowOpen(event.target.checked)}
          className="size-4 accent-[var(--primary)] focus-ring"
        />
        Show pending and confirmed
      </label>
      <ChartFrame label="Stacked bar chart of appointment statuses per month" height={300}>
        <BarChart data={rows} margin={{ top: 22, right: 8, bottom: 0, left: -12 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={BAR_CURSOR} />
          {series.map(({ status, color }, index) => {
            const top = index === series.length - 1;
            return (
              <Bar
                key={status}
                dataKey={status}
                name={APPOINTMENT_STATUS_LABELS[status]}
                stackId="status"
                fill={color}
                // A 2px surface gap separates stacked segments without relying on hue.
                stroke="var(--surface)"
                strokeWidth={2}
                radius={top ? [4, 4, 0, 0] : undefined}
                isAnimationActive={false}
              >
                {top ? <LabelList dataKey="shownTotal" position="top" fontSize={11} fontWeight={500} fill={LABEL_FILL} /> : null}
              </Bar>
            );
          })}
        </BarChart>
      </ChartFrame>
    </div>
  );
}

/** Up to this many categories fit as columns; more switch to horizontal bars. */
const MAX_COLUMN_CATEGORIES = 6;

function RatesChart({
  label,
  rows,
}: {
  label: string;
  rows: { name: string; cancellation: number | null; noShow: number | null }[];
}) {
  const columns = rows.length <= MAX_COLUMN_CATEGORIES;
  const tooltip = (
    <Tooltip
      contentStyle={TOOLTIP_STYLE}
      cursor={BAR_CURSOR}
      formatter={(value) => (typeof value === "number" ? `${value.toFixed(2)}%` : "—")}
    />
  );
  const bars = (position: "top" | "right") => [
    <Bar key="cancellation" dataKey="cancellation" name="Cancellation rate" fill={SERIES.cancelled} radius={columns ? [4, 4, 0, 0] : [0, 4, 4, 0]} isAnimationActive={false}>
      <LabelList dataKey="cancellation" position={position} formatter={labelPercent} fill={LABEL_FILL} fontSize={11} />
    </Bar>,
    <Bar key="noShow" dataKey="noShow" name="No-show rate" fill={SERIES.noShow} radius={columns ? [4, 4, 0, 0] : [0, 4, 4, 0]} isAnimationActive={false}>
      <LabelList dataKey="noShow" position={position} formatter={labelPercent} fill={LABEL_FILL} fontSize={11} />
    </Bar>,
  ];

  if (columns) {
    return (
      <ChartFrame label={label} height={280}>
        <BarChart data={rows} margin={{ top: 22, right: 8, bottom: 0, left: -12 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} />
          <YAxis domain={[0, "auto"]} tickFormatter={percentTick} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
          {tooltip}
          {bars("top")}
        </BarChart>
      </ChartFrame>
    );
  }
  return (
    <ChartFrame label={label} height={Math.max(200, rows.length * 44 + 40)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" domain={[0, "auto"]} tickFormatter={percentTick} tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fill: LABEL_FILL }} tickLine={false} axisLine={false} width={130} />
        {tooltip}
        {bars("right")}
      </BarChart>
    </ChartFrame>
  );
}

function labelPercent(value: unknown) {
  // Whole percents on the bars; the tooltip and table keep two decimals.
  return typeof value === "number" ? `${Math.round(value)}%` : "";
}

export function SlotRatesChart({ data }: { data: SlotRates[] }) {
  const rows = data.map((slot) => ({
    name: `${slot.weekday} ${slot.hourBucket}`,
    cancellation: slot.cancellationRate,
    noShow: slot.noShowRate,
  }));
  return <RatesChart label="Grouped bar chart of cancellation and no-show rates by day and time" rows={rows} />;
}

export function DoctorRatesChart({ data }: { data: DoctorAnalytics[] }) {
  const rows = data
    .filter((doctor) => doctor.dueCount > 0)
    .map((doctor) => ({ name: doctor.doctorName, cancellation: doctor.cancellationRate, noShow: doctor.noShowRate }));
  return <RatesChart label="Grouped bar chart of cancellation and no-show rates by doctor" rows={rows} />;
}
