import {
  isAppointmentStatus,
  type AppointmentStatus,
} from "./status";

export const MANILA_TIME_ZONE = "Asia/Manila";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MANILA_OFFSET = "+08:00";
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export type AppointmentFilters = {
  date: string;
  status: AppointmentStatus | null;
};

function firstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Returns the calendar date in Asia/Manila. Manila has no DST, so this is
 * stable for the day-range calculation used by the read model.
 */
export function todayInManila(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidManilaDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00${MANILA_OFFSET}`);
  return !Number.isNaN(parsed.getTime()) && todayInManila(parsed) === value;
}

export function parseAppointmentFilters(
  input: { date?: string | string[]; status?: string | string[] },
  now: Date = new Date(),
): AppointmentFilters {
  const requestedDate = firstValue(input.date);
  const requestedStatus = firstValue(input.status);

  return {
    date:
      requestedDate && isValidManilaDate(requestedDate)
        ? requestedDate
        : todayInManila(now),
    status:
      requestedStatus && isAppointmentStatus(requestedStatus)
        ? requestedStatus
        : null,
  };
}

export function manilaDayRange(date: string): { start: Date; end: Date } {
  if (!isValidManilaDate(date)) {
    throw new RangeError("Invalid Manila calendar date.");
  }
  const start = new Date(`${date}T00:00:00${MANILA_OFFSET}`);
  return {
    start,
    end: new Date(start.getTime() + DAY_IN_MILLISECONDS),
  };
}
