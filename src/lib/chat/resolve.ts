import { MANILA_TIME_ZONE, isValidManilaDate, todayInManila } from "@/lib/appointments/filters";

/** AI-APT-001: preferred dates more than this many days ahead are rejected. */
export const BOOKING_HORIZON_DAYS = 60;

const DOCTOR_TITLE_PATTERN = /^(dr\.?|doctor|doc)\s+/;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(DOCTOR_TITLE_PATTERN, "")
    .replace(/^dr\.?$/, "");
}

/**
 * Matches a name the patient typed against database doctors. Every word the
 * patient typed must appear in the doctor's name, so "Dr. Santos" returns all
 * Santoses and the caller can ask which one.
 */
export function matchDoctorsByName<T extends { fullName: string }>(name: string, doctors: T[]): T[] {
  const wanted = normaliseName(name).split(" ").filter(Boolean);
  if (wanted.length === 0) return [];

  return doctors.filter((doctor) => {
    const words = normaliseName(doctor.fullName).split(" ");
    return wanted.every((word) => words.includes(word));
  });
}

/**
 * Matches a specialty the patient typed against database specialties. An
 * exact name wins; otherwise every typed word must start a word of the name,
 * so "derma" finds Dermatology and "pediatric" finds every pediatric specialty.
 */
export function matchSpecialtiesByName<T extends { name: string }>(name: string, specialties: T[]): T[] {
  const wanted = normaliseName(name);
  if (!wanted) return [];

  const exact = specialties.filter((specialty) => normaliseName(specialty.name) === wanted);
  if (exact.length > 0) return exact;

  const wantedWords = wanted.split(" ");
  return specialties.filter((specialty) => {
    const words = normaliseName(specialty.name).split(" ");
    return wantedWords.every((typed) => words.some((word) => word.startsWith(typed)));
  });
}

/** Adds calendar days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

export type PreferredDateResult =
  | { status: "ok"; date: string }
  | { status: "past" }
  | { status: "beyond_horizon" }
  | { status: "invalid" };

/** Checks a YYYY-MM-DD date against today and the booking horizon, in Manila. */
export function resolvePreferredDate(value: string, now: Date): PreferredDateResult {
  if (!isValidManilaDate(value)) return { status: "invalid" };

  const today = todayInManila(now);
  if (value < today) return { status: "past" };
  if (value > addDays(today, BOOKING_HORIZON_DAYS)) return { status: "beyond_horizon" };
  return { status: "ok", date: value };
}

/** The last bookable date, inclusive. */
export function bookingHorizonEnd(now: Date): string {
  return addDays(todayInManila(now), BOOKING_HORIZON_DAYS);
}

/** Minutes after Manila midnight; [from, to). */
type MinuteRange = { from: number; to: number };

const DAY_PERIODS: [RegExp, MinuteRange][] = [
  [/\bmorning\b/, { from: 0, to: 12 * 60 }],
  [/\bafternoon\b/, { from: 12 * 60, to: 17 * 60 }],
  [/\bevening\b/, { from: 17 * 60, to: 24 * 60 }],
];

const CLOCK_PATTERN = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/;

/** Reads "morning", "afternoon", "evening", "9am", "1:30 pm", or "13:00"; anything else is null. */
function parsePreferredTime(value: string): MinuteRange | null {
  const text = value.trim().toLowerCase();
  for (const [pattern, range] of DAY_PERIODS) {
    if (pattern.test(text)) return range;
  }

  const clock = CLOCK_PATTERN.exec(text);
  if (!clock) return null;
  const [, hourText, minuteText = "0", meridiem] = clock;
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return { from: hour * 60 + minute, to: 24 * 60 };
}

const MANILA_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: MANILA_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function manilaMinutes(isoTimestamp: string): number {
  const [hour, minute] = MANILA_CLOCK.format(new Date(isoTimestamp)).split(":").map(Number);
  return hour * 60 + minute;
}

/**
 * Keeps slots that match the patient's preferred time in Manila: a period of
 * the day, or at and after a clock time. A time that can't be read filters
 * nothing, so the patient still sees every available slot.
 */
export function filterSlotsByTime<T extends { start: string }>(
  slots: T[],
  preferredTime: string | undefined,
): T[] {
  const range = preferredTime ? parsePreferredTime(preferredTime) : null;
  if (!range) return slots;
  return slots.filter((slot) => {
    const minutes = manilaMinutes(slot.start);
    return minutes >= range.from && minutes < range.to;
  });
}
