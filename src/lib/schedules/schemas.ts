import { z } from "zod";

import { SCHEDULE_EXCEPTION_TYPES, SLOT_DURATIONS } from "./types";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Form fields arrive as "" when left blank; treat that as "not provided". */
const blankToUndefined = (value: unknown) =>
  value === "" || value === null ? undefined : value;

const timeField = (label: string) =>
  z.string().regex(TIME_PATTERN, `Enter ${label} as HH:MM (24-hour).`);

const dateField = z.string().regex(DATE_PATTERN, "Choose a valid date.");

export const schedulePeriodSchema = z
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
    effectiveFrom: dateField,
    effectiveUntil: z.preprocess(
      blankToUndefined,
      dateField.optional().transform((value) => value ?? null),
    ),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after the start time.",
    path: ["endTime"],
  })
  .refine(
    (value) =>
      value.effectiveUntil === null || value.effectiveUntil >= value.effectiveFrom,
    {
      message: "The last effective date cannot be before the first.",
      path: ["effectiveUntil"],
    },
  );

export type SchedulePeriodInput = z.infer<typeof schedulePeriodSchema>;

export const scheduleExceptionSchema = z
  .object({
    startDate: dateField,
    endDate: z.preprocess(blankToUndefined, dateField.optional()),
    startTime: z.preprocess(blankToUndefined, timeField("a start time").optional()),
    endTime: z.preprocess(blankToUndefined, timeField("an end time").optional()),
    exceptionType: z.enum(SCHEDULE_EXCEPTION_TYPES, "Choose an exception type."),
    reason: z
      .string()
      .trim()
      .min(3, "Please give a short reason for this exception.")
      .max(200, "Keep the reason under 200 characters."),
  })
  .refine(
    (value) => (value.startTime === undefined) === (value.endTime === undefined),
    {
      message: "Enter both a start and end time, or leave both blank for whole days.",
      path: ["endTime"],
    },
  )
  .refine(
    (value) => {
      const { start, end } = exceptionInterval(value);
      return end > start;
    },
    { message: "The exception must end after it starts.", path: ["endDate"] },
  );

export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionSchema>;

/**
 * The [start, end) UTC interval an exception covers. Without times it blocks
 * whole Manila days from `startDate` through `endDate`; with times it runs
 * from `startDate startTime` to `endDate endTime`.
 */
export function exceptionInterval(input: {
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}): { start: Date; end: Date } {
  const endDate = input.endDate ?? input.startDate;
  if (input.startTime === undefined || input.endTime === undefined) {
    const lastDayStart = new Date(`${endDate}T00:00:00+08:00`);
    return {
      start: new Date(`${input.startDate}T00:00:00+08:00`),
      end: new Date(lastDayStart.getTime() + 24 * 60 * 60 * 1000),
    };
  }
  return {
    start: new Date(`${input.startDate}T${input.startTime}:00+08:00`),
    end: new Date(`${endDate}T${input.endTime}:00+08:00`),
  };
}

export const scheduleRecordIdSchema = z.uuid("Invalid schedule reference.");

export const doctorIdSchema = z.uuid("Choose a doctor.");

export const availabilityQuerySchema = z
  .object({
    doctorId: z.preprocess(blankToUndefined, z.uuid("Choose a doctor.").optional()),
    specialtyId: z.preprocess(
      blankToUndefined,
      z.uuid("Choose a specialty.").optional(),
    ),
    fromDate: dateField,
    days: z.coerce.number().int().min(1).max(14).default(7),
  })
  .refine((value) => value.doctorId || value.specialtyId, {
    message: "Choose a doctor or a specialty.",
    path: ["doctorId"],
  });

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
