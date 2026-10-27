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
