import type { ChargeLineInput } from "@/lib/billing/compute";
import {
  intervalsOverlap,
  manilaParts,
  timeToMinutes,
  type SlotInterval,
} from "@/lib/schedules/availability";
import { isScheduleEffectiveOn } from "@/lib/schedules/types";

import type { ServiceCategory } from "./types";

/**
 * PAY-07 service booking rules, pure and isomorphic. They mirror
 * cammi_connect_book_service (0038), which re-checks every one of them.
 */

/** A service Cami can book: active, walk-in or scheduled, and priced. */
export type BookableService = {
  id: string;
  name: string;
  category: ServiceCategory;
  bookingMode: "walk_in" | "scheduled";
  priceCentavos: number;
  vatable: boolean;
  philhealthBenefitCentavos: number;
  hmoCoverable: boolean;
  requiresDoctorRequest: boolean;
  dailyCapacity: number | null;
};

/** One weekly period of a service (service_schedules). Times and dates are Manila. */
export type ServicePeriod = {
  serviceId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacityPerSlot: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
  isActive: boolean;
};

/** Holding visits per start time, from cammi_connect_service_load. */
export type ServiceLoad = { serviceId: string; start: Date; bookings: number };

/** What the patient picks first in chat: lab tests (multi-select), diagnostics, or a package. */
export const SERVICE_KINDS = ["lab", "diagnostics", "package"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  lab: "Lab tests",
  diagnostics: "Imaging and diagnostics",
  package: "Check-up packages",
};

export function serviceKindOf(category: ServiceCategory): ServiceKind {
  if (category === "laboratory") return "lab";
  if (category === "package") return "package";
  return "diagnostics";
}

/** Matches the 1–5 limit in cammi_connect_book_service. */
export const MAX_SERVICES_PER_VISIT = 5;

/** One to five distinct services; several only when all are walk-in lab tests. */
export function validateServiceSelection(
  services: readonly Pick<BookableService, "id" | "category" | "bookingMode">[],
): boolean {
  if (services.length === 0 || services.length > MAX_SERVICES_PER_VISIT) return false;
  if (new Set(services.map((entry) => entry.id)).size !== services.length) return false;
  return (
    services.length === 1 ||
    services.every((entry) => entry.category === "laboratory" && entry.bookingMode === "walk_in")
  );
}

export function serviceLine(service: BookableService): ChargeLineInput {
  return {
    baseCentavos: service.priceCentavos,
    vatable: service.vatable,
    philhealthBenefitCentavos: service.philhealthBenefitCentavos,
    hmoCoverable: service.hmoCoverable,
  };
}

/** An HMO is offered only when it would cover a line (packages usually aren't). */
export function hmoOffered(lines: readonly ChargeLineInput[]): boolean {
  return lines.some((line) => line.hmoCoverable);
}

const MINUTE_MILLISECONDS = 60 * 1000;
const DAY_MILLISECONDS = 24 * 60 * MINUTE_MILLISECONDS;
/** Matches the 480-minute appointment limit; a walk-in visit spans the opening hours. */
const MAX_VISIT_MINUTES = 480;

function manilaDates(fromDate: string, days: number): string[] {
  const first = Date.parse(`${fromDate}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) =>
    new Date(first + index * DAY_MILLISECONDS).toISOString().slice(0, 10),
  );
}

function periodsOn(periods: readonly ServicePeriod[], date: string): ServicePeriod[] {
  const { dayOfWeek } = manilaParts(new Date(`${date}T00:00:00+08:00`));
  return periods.filter(
    (period) =>
      period.isActive && period.dayOfWeek === dayOfWeek && isScheduleEffectiveOn(period, date),
  );
}

function atManila(date: string, minutes: number): Date {
  return new Date(Date.parse(`${date}T00:00:00+08:00`) + minutes * MINUTE_MILLISECONDS);
}

/**
 * Bookable slots of one scheduled service: each period's grid from its start,
 * no partial last slot, later than `now`, clear of hospital holidays, and
 * below the period's capacity per slot.
 */
export function serviceSlots(input: {
  periods: readonly ServicePeriod[];
  holidays: readonly SlotInterval[];
  load: readonly Pick<ServiceLoad, "start" | "bookings">[];
  fromDate: string;
  days: number;
  now: Date;
}): SlotInterval[] {
  const booked = new Map<number, number>();
  for (const entry of input.load) {
    const key = entry.start.getTime();
    booked.set(key, (booked.get(key) ?? 0) + entry.bookings);
  }

  const slots: SlotInterval[] = [];
  for (const date of manilaDates(input.fromDate, input.days)) {
    for (const period of periodsOn(input.periods, date)) {
      const periodEnd = timeToMinutes(period.endTime);
      for (
        let minute = timeToMinutes(period.startTime);
        minute + period.slotMinutes <= periodEnd;
        minute += period.slotMinutes
      ) {
        const slot = {
          start: atManila(date, minute),
          end: atManila(date, minute + period.slotMinutes),
        };
        if (
          slot.start > input.now &&
          !input.holidays.some((holiday) => intervalsOverlap(slot, holiday)) &&
          (booked.get(slot.start.getTime()) ?? 0) < period.capacityPerSlot
        ) {
          slots.push(slot);
        }
      }
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type WalkInDate = { date: string; start: Date; end: Date };

/**
 * Dates a walk-in visit can be booked for: every chosen service is open, the
 * visit (from the first service's opening to its closing, at most 8 hours)
 * starts after `now` and misses every holiday, and no service with a daily
 * capacity is full that day.
 */
export function walkInDates(input: {
  /** In the patient's order; the first one sets the visit's hours. */
  services: readonly { id: string; dailyCapacity: number | null; periods: readonly ServicePeriod[] }[];
  holidays: readonly SlotInterval[];
  load: readonly ServiceLoad[];
  fromDate: string;
  days: number;
  now: Date;
}): WalkInDate[] {
  const [primary] = input.services;
  if (!primary) return [];

  const dates: WalkInDate[] = [];
  for (const date of manilaDates(input.fromDate, input.days)) {
    if (input.services.some((entry) => periodsOn(entry.periods, date).length === 0)) continue;

    const hours = periodsOn(primary.periods, date);
    const open = Math.min(...hours.map((period) => timeToMinutes(period.startTime)));
    const close = Math.max(...hours.map((period) => timeToMinutes(period.endTime)));
    const visit = { start: atManila(date, open), end: atManila(date, open + Math.min(MAX_VISIT_MINUTES, close - open)) };
    if (visit.start <= input.now) continue;
    if (input.holidays.some((holiday) => intervalsOverlap(visit, holiday))) continue;

    const dayStart = atManila(date, 0).getTime();
    const full = input.services.some((entry) => {
      if (entry.dailyCapacity === null) return false;
      const bookings = input.load
        .filter(
          (load) =>
            load.serviceId === entry.id &&
            load.start.getTime() >= dayStart &&
            load.start.getTime() < dayStart + DAY_MILLISECONDS,
        )
        .reduce((sum, load) => sum + load.bookings, 0);
      return bookings >= entry.dailyCapacity;
    });
    if (!full) dates.push({ date, ...visit });
  }
  return dates;
}
