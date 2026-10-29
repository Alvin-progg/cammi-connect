import { todayInManila } from "./filters";
import type { DoctorAppointment } from "./types";

/**
 * Pure layout for the doctor's weekly time grid. Everything is computed in
 * Asia/Manila (fixed UTC+8, no DST), so plain offset arithmetic is safe.
 */

const MINUTE = 60 * 1000;
const DAY_IN_MINUTES = 24 * 60;
const MANILA_OFFSET_MINUTES = 8 * 60;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type WeekDay = {
  date: string;
  weekdayLabel: string;
  dayNumber: number;
  isToday: boolean;
};

export type WeekBlock = {
  appointment: DoctorAppointment;
  endsAt: string;
  dayIndex: number;
  topPct: number;
  heightPct: number;
  /** Side-by-side position among overlapping blocks of the same day. */
  lane: number;
  laneCount: number;
};

export type WeekNowLine = {
  dayIndex: number;
  topPct: number;
  label: string;
};

export type WeekLayout = {
  days: WeekDay[];
  startHour: number;
  endHour: number;
  hours: number[];
  blocks: WeekBlock[];
  nowLine: WeekNowLine | null;
};

/** Minutes since the Manila epoch day 0, so day and time-of-day fall out of division. */
function manilaMinutes(timestamp: Date): number {
  return Math.floor(timestamp.getTime() / MINUTE) + MANILA_OFFSET_MINUTES;
}

function dayNumberOf(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / MINUTE / DAY_IN_MINUTES);
}

function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

type PlacedAppointment = {
  appointment: DoctorAppointment;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
};

/** Greedy lane assignment within each cluster of transitively overlapping blocks. */
function assignLanes(dayItems: PlacedAppointment[]) {
  const sorted = [...dayItems].sort(
    (a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute,
  );
  const lanes = new Map<PlacedAppointment, { lane: number; laneCount: number }>();

  let cluster: PlacedAppointment[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const item of cluster) {
      const entry = lanes.get(item);
      if (entry) {
        entry.laneCount = laneEnds.length;
      }
    }
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (item.startMinute >= clusterEnd) {
      closeCluster();
    }
    let lane = laneEnds.findIndex((end) => end <= item.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMinute);
    } else {
      laneEnds[lane] = item.endMinute;
    }
    cluster.push(item);
    lanes.set(item, { lane, laneCount: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMinute);
  }
  closeCluster();

  return lanes;
}

export function buildWeekLayout(input: {
  weekStart: string;
  appointments: DoctorAppointment[];
  now?: Date;
}): WeekLayout {
  const now = input.now ?? new Date();
  const today = todayInManila(now);
  const firstDay = dayNumberOf(input.weekStart);

  const days: WeekDay[] = WEEKDAY_LABELS.map((weekdayLabel, index) => {
    const date = addDays(input.weekStart, index);
    return {
      date,
      weekdayLabel,
      dayNumber: Number(date.slice(8, 10)),
      isToday: date === today,
    };
  });

  const placed: PlacedAppointment[] = [];
  for (const appointment of input.appointments) {
    const start = manilaMinutes(new Date(appointment.scheduledAt));
    const dayIndex = Math.floor(start / DAY_IN_MINUTES) - firstDay;
    if (dayIndex < 0 || dayIndex > 6) {
      continue;
    }
    const startMinute = start % DAY_IN_MINUTES;
    placed.push({
      appointment,
      dayIndex,
      startMinute,
      // Blocks that run past midnight are clipped to their start day.
      endMinute: Math.min(startMinute + appointment.durationMinutes, DAY_IN_MINUTES),
    });
  }

  const startHour = Math.min(
    DEFAULT_START_HOUR,
    ...placed.map((item) => Math.floor(item.startMinute / 60)),
  );
  const endHour = Math.max(
    DEFAULT_END_HOUR,
    ...placed.map((item) => Math.ceil(item.endMinute / 60)),
  );
  const gridStart = startHour * 60;
  const gridMinutes = (endHour - startHour) * 60;
  const toPct = (minutes: number) => (minutes / gridMinutes) * 100;

  const blocks: WeekBlock[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const dayItems = placed.filter((item) => item.dayIndex === dayIndex);
    const lanes = assignLanes(dayItems);
    for (const item of dayItems) {
      const { lane, laneCount } = lanes.get(item) ?? { lane: 0, laneCount: 1 };
      blocks.push({
        appointment: item.appointment,
        endsAt: new Date(
          Date.parse(item.appointment.scheduledAt) +
            item.appointment.durationMinutes * MINUTE,
        ).toISOString(),
        dayIndex,
        topPct: toPct(item.startMinute - gridStart),
        heightPct: toPct(item.endMinute - item.startMinute),
        lane,
        laneCount,
      });
    }
  }

  let nowLine: WeekNowLine | null = null;
  const todayIndex = days.findIndex((day) => day.isToday);
  const nowMinute = manilaMinutes(now) % DAY_IN_MINUTES;
  if (todayIndex !== -1 && nowMinute >= gridStart && nowMinute <= endHour * 60) {
    const hours = String(Math.floor(nowMinute / 60)).padStart(2, "0");
    const minutes = String(nowMinute % 60).padStart(2, "0");
    nowLine = {
      dayIndex: todayIndex,
      topPct: toPct(nowMinute - gridStart),
      label: `${hours}:${minutes}`,
    };
  }

  return {
    days,
    startHour,
    endHour,
    hours: Array.from({ length: endHour - startHour }, (_, index) => startHour + index),
    blocks,
    nowLine,
  };
}
