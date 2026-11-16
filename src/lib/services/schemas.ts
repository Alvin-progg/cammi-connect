import { z } from "zod";

import { optionalPesoField, pesoFieldOrZero } from "@/lib/billing/money";
import { optionalDescription } from "@/lib/directory/schemas";
import { schedulePeriodSchema } from "@/lib/schedules/schemas";

import { SERVICE_BOOKING_MODES, SERVICE_CATEGORIES } from "./types";

const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

const DAILY_CAPACITY_MESSAGE = "Enter a daily capacity from 1 to 1000, or leave it blank.";

/**
 * The admin service form. Activation is a separate audited action, so it is
 * not part of this form. An unchecked checkbox is absent from the form data,
 * which reads as "no appointment required".
 */
export const serviceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a service name.")
    .max(100, "Keep the name under 100 characters."),
  description: optionalDescription,
  departmentId: z.preprocess(
    blankToNull,
    z.uuid("Choose a valid department.").nullable().default(null),
  ),
  requiresAppointment: checkbox,
  bookingMode: z
    .enum(SERVICE_BOOKING_MODES, "Choose how patients access the service.")
    .default("none"),
  // PAY-01 pricing. Money is typed in pesos and kept as integer centavos.
  category: z.enum(SERVICE_CATEGORIES, "Choose a category.").default("other"),
  priceCentavos: optionalPesoField("Enter the price in pesos, like 1500 or 1500.50."),
  vatable: checkbox,
  philhealthBenefitCentavos: pesoFieldOrZero(
    "Enter the PhilHealth benefit in pesos, like 500 or 500.50.",
  ),
  hmoCoverable: checkbox,
  requiresDoctorRequest: checkbox,
  dailyCapacity: z.preprocess(
    (value) => {
      const blank = blankToNull(value);
      return typeof blank === "string" && /^\d+$/.test(blank.trim()) ? Number(blank) : blank;
    },
    z
      .number(DAILY_CAPACITY_MESSAGE)
      .int(DAILY_CAPACITY_MESSAGE)
      .min(1, DAILY_CAPACITY_MESSAGE)
      .max(1000, DAILY_CAPACITY_MESSAGE)
      .nullable()
      .default(null),
  ),
});

export type ServiceFormInput = z.infer<typeof serviceFormSchema>;

/**
 * PAY-07: one weekly period of a walk-in or scheduled service. The doctor
 * period rules plus a capacity per slot (1–100, as in 0038). A walk-in
 * service uses its periods as opening hours.
 */
export const serviceScheduleFormSchema = schedulePeriodSchema.and(
  z.object({
    capacityPerSlot: z.coerce
      .number("Enter a capacity from 1 to 100.")
      .int("Enter a capacity from 1 to 100.")
      .min(1, "Enter a capacity from 1 to 100.")
      .max(100, "Enter a capacity from 1 to 100."),
  }),
);

export type ServiceScheduleInput = z.infer<typeof serviceScheduleFormSchema>;
