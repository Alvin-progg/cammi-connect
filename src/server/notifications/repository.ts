import "server-only";

import type { DoctorNotification } from "@/lib/notifications/types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { DoctorNotificationsReader } from "./service";

export const supabaseDoctorNotificationsRepository: DoctorNotificationsReader =
  {
    async listForDoctor({ doctorId, limit }) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("doctor_notifications")
        .select("id, appointment_id, type, title, body, read_at, created_at")
        .eq("doctor_id", doctorId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error("Unable to load notifications.");
      }
      return (data ?? []).map(
        (row): DoctorNotification => ({
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

    async countUnreadForDoctor(doctorId) {
      const supabase = getSupabaseAdminClient();
      const { count, error } = await supabase
        .from("doctor_notifications")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .is("read_at", null);

      if (error) {
        throw new Error("Unable to count unread notifications.");
      }
      return count ?? 0;
    },

    async markRead({ doctorId, notificationId }) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("doctor_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("doctor_id", doctorId)
        .is("read_at", null)
        .select("id");

      if (error) {
        throw new Error("Unable to update the notification.");
      }
      return (data ?? []).length > 0;
    },

    async markAllRead(doctorId) {
      const supabase = getSupabaseAdminClient();
      const { error } = await supabase
        .from("doctor_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("doctor_id", doctorId)
        .is("read_at", null);

      if (error) {
        throw new Error("Unable to update notifications.");
      }
    },
  };
