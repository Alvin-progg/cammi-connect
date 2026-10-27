import { z } from "zod";

import { SLOT_DURATIONS } from "./types";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const timeField = (label: string) =>
  z.string().regex(TIME_PATTERN, `Enter ${label} as HH:MM (24-hour).`);

export const scheduleDaySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    isActive: z.boolean(),
    startTime: timeField("a start time"),
    endTime: timeField("an end time"),
    slotDurationMinutes: z.coerce
      .number()
      .refine(
        (value) => (SLOT_DURATIONS as readonly number[]).includes(value),
        "Choose a slot duration of 15, 30, 45, or 60 minutes.",
      ),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after the start time.",
    path: ["endTime"],
  });

export const blockSlotSchema = z
  .object({
    date: z.string().regex(DATE_PATTERN, "Choose a valid date."),
    startTime: timeField("a start time"),
    endTime: timeField("an end time"),
    reason: z
      .string()
      .trim()
      .min(3, "Please give a short reason for blocking this time.")
      .max(200, "Keep the reason under 200 characters."),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after the start time.",
    path: ["endTime"],
  });

export const blockIdSchema = z.uuid("Invalid blocked slot reference.");

/** Builds the [start, end) UTC interval for a Manila local date + times. */
export function manilaLocalToUtcInterval(input: {
  date: string;
  startTime: string;
  endTime: string;
}): { start: Date; end: Date } {
  return {
    start: new Date(`${input.date}T${input.startTime}:00+08:00`),
    end: new Date(`${input.date}T${input.endTime}:00+08:00`),
  };
}
