import "server-only";

import { canPatientCancel } from "@/lib/appointments/transitions";
import { APPOINTMENTS_COPY } from "@/lib/chat/appointments";
import type { AppointmentEvent, ChatMessagePayload } from "@/lib/chat/schemas";

import type { ChatTools } from "./tools";

export type AppointmentReply = {
  reply: string;
  payload: ChatMessagePayload | null;
};

const EVENT_LABELS: Record<AppointmentEvent["type"], string> = {
  request_cancellation: "Cancel appointment",
  confirm_cancellation: "Confirm cancellation",
};

/**
 * The patient's upcoming appointments as a card. `lead` is the templated text
 * for a status question or a cancel request.
 */
export async function showPatientAppointments(
  patientId: string,
  tools: ChatTools,
  lead: string,
): Promise<AppointmentReply> {
  const appointments = await tools.getPatientAppointments({ patientId });
  if (appointments.length === 0) {
    return { reply: APPOINTMENTS_COPY.none, payload: null };
  }
  return {
    reply: lead,
    payload: {
      kind: "appointments",
      items: appointments.map((appointment) => ({
        id: appointment.id,
        doctorName: appointment.doctorName,
        departmentName: appointment.departmentName,
        start: appointment.scheduledAt,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
      })),
    },
  };
}

/**
 * Appointment card actions. The appointment ID is only a reference: it is
 * re-read with the session's patient ID, so another patient's appointment is
 * reported as not found. The confirm step is a card rather than a booking
 * state; the guarded cancel makes a skipped or repeated confirm harmless.
 */
export async function handleAppointmentEvent(
  event: AppointmentEvent,
  patientId: string,
  tools: ChatTools,
): Promise<AppointmentReply & { userContent: string }> {
  const userContent = EVENT_LABELS[event.type];
  const input = { patientId, appointmentId: event.appointmentId };

  if (event.type === "request_cancellation") {
    const appointment = await tools.getPatientAppointment(input);
    if (!appointment) {
      return { reply: "Appointment not found.", payload: null, userContent };
    }
    if (!canPatientCancel(appointment.status)) {
      return {
        reply: "This appointment can no longer be cancelled.",
        payload: null,
        userContent,
      };
    }
    return {
      reply: APPOINTMENTS_COPY.confirmCancel,
      payload: {
        kind: "cancel_confirmation",
        appointmentId: appointment.id,
        doctorName: appointment.doctorName,
        start: appointment.scheduledAt,
      },
      userContent,
    };
  }

  const result = await tools.requestAppointmentCancellation(input);
  if (!result.ok) {
    return { reply: result.message, payload: null, userContent };
  }
  return {
    reply: APPOINTMENTS_COPY.cancelled,
    payload: {
      kind: "cancel_result",
      doctorName: result.appointment.doctorName,
      start: result.appointment.scheduledAt,
    },
    userContent,
  };
}
