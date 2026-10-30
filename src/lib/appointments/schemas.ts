import { z } from "zod";

export const appointmentIdSchema = z.uuid("Invalid appointment reference.");

export const cancelAppointmentSchema = z.object({
  appointmentId: appointmentIdSchema,
  reason: z
    .string()
    .trim()
    .min(3, "Please give a short reason for cancelling.")
    .max(500, "Keep the reason under 500 characters."),
});

export const rescheduleAppointmentSchema = z.object({
  appointmentId: appointmentIdSchema,
  newScheduledAt: z
    .string()
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Choose a valid date and time.",
    ),
  note: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters.")
    .optional(),
});

export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<
  typeof rescheduleAppointmentSchema
>;

/**
 * Patient booking request. The patient is never part of the input; it comes
 * from the session. Duration comes from the doctor's schedule, not the form.
 */
export const bookAppointmentSchema = z.object({
  doctorId: z.uuid("Choose a doctor."),
  scheduledAt: z.iso
    .datetime({ offset: true, message: "Choose a valid appointment time." })
    .transform((value) => new Date(value)),
  reason: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z
      .string()
      .trim()
      .max(500, "Keep the reason under 500 characters.")
      .nullable()
      .default(null),
  ),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
