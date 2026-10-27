"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDoctorSession } from "@/server/auth/dal";

import { supabaseDoctorNotificationsRepository } from "./repository";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./service";

export type NotificationActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const notificationIdSchema = z.uuid("Invalid notification reference.");

export async function markNotificationReadAction(
  _previous: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage notifications.",
    };
  }

  const parsed = notificationIdSchema.safeParse(
    formData.get("notificationId"),
  );
  if (!parsed.success) {
    return { status: "error", message: "Invalid notification reference." };
  }

  await markNotificationRead(
    { doctorId: session.doctor.id, notificationId: parsed.data },
    supabaseDoctorNotificationsRepository,
  );
  revalidatePath("/doctor");
  return { status: "success", message: "Notification marked as read." };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionState> {
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to manage notifications.",
    };
  }

  await markAllNotificationsRead(
    session.doctor.id,
    supabaseDoctorNotificationsRepository,
  );
  revalidatePath("/doctor");
  return { status: "success", message: "All notifications marked as read." };
}
