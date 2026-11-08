"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
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

const AXIS_TICK = { fill: "var(--ink-secondary)", fontSize: 12 };
const GRID_STROKE = "var(--line)";
const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  color: "var(--ink)",
  fontSize: 13,
};
const CHART_HEIGHT = 288;

const SERIES = {
  volume: "var(--chart-1)",
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
  return (
    <ChartFrame label="Line chart of appointments per month">
      <LineChart data={points} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Line
          type="monotone"
          dataKey="total"
          name="Appointments"
          stroke={SERIES.volume}
          strokeWidth={2}
          dot={{ r: 4, fill: SERIES.volume }}
          isAnimationActive={false}
        >
          <LabelList dataKey="total" position="top" fill="var(--ink-secondary)" fontSize={12} />
        </Line>
      </LineChart>
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
    <ChartFrame label="Bar chart of appointments per doctor" height={Math.max(160, rows.length * 40 + 40)}>
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

const OUTCOME_SERIES: { status: VolumeStatus; color: string }[] = [
  { status: "completed", color: SERIES.completed },
  { status: "cancelled", color: SERIES.cancelled },
  { status: "no_show", color: SERIES.noShow },
];
const OPEN_SERIES: { status: VolumeStatus; color: string }[] = [
  { status: "requested", color: SERIES.requested },
  { status: "confirmed", color: SERIES.confirmed },
];

export function StatusByMonthChart({ data }: { data: MonthlyStatusCounts[] }) {
  const [showOpen, setShowOpen] = useState(false);
  const series = showOpen ? [...OUTCOME_SERIES, ...OPEN_SERIES] : OUTCOME_SERIES;
  const rows = data.map((month) => ({ month: formatMonth(month.month), ...month.counts }));

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={showOpen}
          onChange={(event) => setShowOpen(event.target.checked)}
          className="size-4 accent-[var(--primary)] focus-ring"
        />
        Show pending and confirmed
      </label>
      <ChartFrame label="Stacked bar chart of appointment statuses per month">
        <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--surface-muted)" }} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          {series.map(({ status, color }) => (
            <Bar
              key={status}
              dataKey={status}
              name={APPOINTMENT_STATUS_LABELS[status]}
              stackId="status"
              fill={color}
              // A surface-coloured edge separates stacked segments without relying on hue.
              stroke="var(--surface)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartFrame>
    </div>
  );
}

function RatesChart({
  label,
  rows,
  categoryWidth,
}: {
  label: string;
  rows: { name: string; cancellation: number | null; noShow: number | null }[];
  categoryWidth: number;
}) {
  return (
    <ChartFrame label={label} height={Math.max(180, rows.length * 48 + 60)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={percentTick}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={categoryWidth} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "var(--surface-muted)" }}
          formatter={(value) => (typeof value === "number" ? `${value.toFixed(2)}%` : "—")}
        />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Bar dataKey="cancellation" name="Cancellation rate" fill={SERIES.cancelled} isAnimationActive={false}>
          <LabelList dataKey="cancellation" position="right" formatter={labelPercent} fill="var(--ink-secondary)" fontSize={12} />
        </Bar>
        <Bar
          dataKey="noShow"
          name="No-show rate"
          fill={SERIES.noShow}
          // Hatched edge distinguishes no-shows from cancellations without hue.
          stroke="var(--ink-secondary)"
          strokeDasharray="3 2"
          isAnimationActive={false}
        >
          <LabelList dataKey="noShow" position="right" formatter={labelPercent} fill="var(--ink-secondary)" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

function labelPercent(value: unknown) {
  return typeof value === "number" ? `${value}%` : "";
}

export function SlotRatesChart({ data }: { data: SlotRates[] }) {
  const rows = data.map((slot) => ({
    name: `${slot.weekday} ${slot.hourBucket}`,
    cancellation: slot.cancellationRate,
    noShow: slot.noShowRate,
  }));
  return <RatesChart label="Grouped bar chart of cancellation and no-show rates by day and time" rows={rows} categoryWidth={96} />;
}

export function DoctorRatesChart({ data }: { data: DoctorAnalytics[] }) {
  const rows = data
    .filter((doctor) => doctor.dueCount > 0)
    .map((doctor) => ({ name: doctor.doctorName, cancellation: doctor.cancellationRate, noShow: doctor.noShowRate }));
  return <RatesChart label="Grouped bar chart of cancellation and no-show rates by doctor" rows={rows} categoryWidth={140} />;
}
