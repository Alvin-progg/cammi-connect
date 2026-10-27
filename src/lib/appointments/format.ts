import { MANILA_TIME_ZONE } from "./filters";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatManilaDate(date: string): string {
  return DATE_FORMATTER.format(new Date(`${date}T00:00:00+08:00`));
}

/** "Mon, 26 Oct" */
export function formatManilaShortDate(isoTimestamp: string): string {
  return SHORT_DATE_FORMATTER.format(new Date(isoTimestamp));
}

export function formatManilaTime(isoTimestamp: string): string {
  return TIME_FORMATTER.format(new Date(isoTimestamp));
}

/** "26 Oct, 9:00 AM" */
export function formatManilaDateTime(isoTimestamp: string): string {
  return DATE_TIME_FORMATTER.format(new Date(isoTimestamp));
}
