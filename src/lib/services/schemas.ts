import { z } from "zod";

import { optionalDescription } from "@/lib/directory/schemas";

import { SERVICE_BOOKING_MODES } from "./types";

const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

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
  requiresAppointment: z.preprocess(
    (value) => value === "on" || value === "true" || value === true,
    z.boolean(),
  ),
  bookingMode: z
    .enum(SERVICE_BOOKING_MODES, "Choose how patients access the service.")
    .default("none"),
});

export type ServiceFormInput = z.infer<typeof serviceFormSchema>;
