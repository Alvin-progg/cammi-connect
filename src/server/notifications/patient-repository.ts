import "server-only";

import type { PatientNotification } from "@/lib/notifications/types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { PatientNotificationsReader } from "./patient-service";

export const supabasePatientNotificationsRepository: PatientNotificationsReader = {
  async listForPatient({ patientId, limit }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("patient_notifications")
      .select("id, appointment_id, type, title, body, read_at, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error("Unable to load notifications.");
    }
    return (data ?? []).map(
      (row): PatientNotification => ({
        id: row.id,
        appointmentId: row.appointment_id,
        type: row.type,
        title: row.title,
        body: row.body,
        readAt: row.read_at,
        createdAt: row.created_at,
      }),
    );
  },

  async countUnreadForPatient(patientId) {
    const supabase = getSupabaseAdminClient();
    const { count, error } = await supabase
      .from("patient_notifications")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .is("read_at", null);

    if (error) {
      throw new Error("Unable to count unread notifications.");
    }
    return count ?? 0;
  },

  async markRead({ patientId, notificationId }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("patient_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("patient_id", patientId)
      .is("read_at", null)
      .select("id");

    if (error) {
      throw new Error("Unable to update the notification.");
    }
    return (data ?? []).length > 0;
  },

  async markAllRead(patientId) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("patient_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("patient_id", patientId)
      .is("read_at", null);

    if (error) {
      throw new Error("Unable to update notifications.");
    }
  },
};
