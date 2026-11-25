"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getPatientSession } from "@/server/auth/dal";

import { supabasePatientNotificationsRepository } from "./patient-repository";
import {
  markAllPatientNotificationsRead,
  markPatientNotificationRead,
} from "./patient-service";

export type PatientNotificationActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const notificationIdSchema = z.uuid("Invalid notification reference.");

export async function markPatientNotificationReadAction(
  _previous: PatientNotificationActionState,
  formData: FormData,
): Promise<PatientNotificationActionState> {
  const session = await getPatientSession("/chat");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage notifications.",
    };
  }

  const parsed = notificationIdSchema.safeParse(formData.get("notificationId"));
  if (!parsed.success) {
    return { status: "error", message: "Invalid notification reference." };
  }

  await markPatientNotificationRead(
    { patientId: session.patient.id, notificationId: parsed.data },
    supabasePatientNotificationsRepository,
  );
  revalidatePath("/chat", "layout");
  return { status: "success", message: "Notification marked as read." };
}

export async function markAllPatientNotificationsReadAction(): Promise<PatientNotificationActionState> {
  const session = await getPatientSession("/chat");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage notifications.",
    };
  }

  await markAllPatientNotificationsRead(
    session.patient.id,
    supabasePatientNotificationsRepository,
  );
  revalidatePath("/chat", "layout");
  return { status: "success", message: "All notifications marked as read." };
}
