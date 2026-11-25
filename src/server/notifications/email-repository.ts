import "server-only";

// Type-only imports: scripts/send-notification-emails.mts loads this file with
// plain Node (--conditions=react-server), which cannot resolve the @/ alias.
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationAudience, NotificationEmailStore, PendingNotificationEmail } from "@/lib/notifications/email";
import type { Database } from "@/server/db/database.types";

/** A failed send is retried by later runs until this many attempts. */
const MAX_EMAIL_ATTEMPTS = 3;
/** Older pending rows are left alone: stale news is worse than none. */
const PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;

const TABLE: Record<NotificationAudience, "patient_notifications" | "doctor_notifications"> = {
  patient: "patient_notifications",
  doctor: "doctor_notifications",
};

/**
 * Outbox store over patient_notifications and doctor_notifications (0047).
 * Takes the service-role client: recipient emails live only in auth.users.
 */
export function createNotificationEmailStore(supabase: SupabaseClient<Database>): NotificationEmailStore {
  return {
    async listPending(limit) {
      const since = new Date(Date.now() - PENDING_WINDOW_MS).toISOString();
      const [patients, doctors] = await Promise.all([
        supabase
          .from("patient_notifications")
          .select("id, patient_id, type, title, body, created_at")
          .is("emailed_at", null)
          .lt("email_attempts", MAX_EMAIL_ATTEMPTS)
          .gte("created_at", since)
          .order("created_at")
          .limit(limit),
        supabase
          .from("doctor_notifications")
          .select("id, doctor_id, type, title, body, created_at")
          .is("emailed_at", null)
          .lt("email_attempts", MAX_EMAIL_ATTEMPTS)
          .gte("created_at", since)
          .order("created_at")
          .limit(limit),
      ]);
      if (patients.error || doctors.error) {
        throw new Error("Unable to load pending notification emails.");
      }

      const rows: (PendingNotificationEmail & { createdAt: string })[] = [
        ...(patients.data ?? []).map((row) => ({
          audience: "patient" as const,
          id: row.id,
          recipientProfileId: row.patient_id,
          type: row.type,
          title: row.title,
          body: row.body,
          createdAt: row.created_at,
        })),
        ...(doctors.data ?? []).map((row) => ({
          audience: "doctor" as const,
          id: row.id,
          recipientProfileId: row.doctor_id,
          type: row.type,
          title: row.title,
          body: row.body,
          createdAt: row.created_at,
        })),
      ];
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit);
    },

    async findRecipientEmail(profileId) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("auth_user_id, is_active")
        .eq("id", profileId)
        .maybeSingle();
      if (error) throw new Error("Unable to load the notification recipient.");
      if (!profile?.auth_user_id || !profile.is_active) return null;

      const { data, error: authError } = await supabase.auth.admin.getUserById(profile.auth_user_id);
      if (authError) throw new Error("Unable to load the notification recipient.");
      return data.user?.email ?? null;
    },

    async claim(audience, id) {
      const { data, error } = await supabase
        .from(TABLE[audience])
        .update({ emailed_at: new Date().toISOString() })
        .eq("id", id)
        .is("emailed_at", null)
        .select("id");
      if (error) throw new Error("Unable to claim the notification email.");
      return (data ?? []).length > 0;
    },

    async release(audience, id) {
      // Only this run holds the claim, so read-then-write cannot race.
      const { data, error } = await supabase.from(TABLE[audience]).select("email_attempts").eq("id", id).single();
      if (error) throw new Error("Unable to release the notification email.");

      const { error: updateError } = await supabase
        .from(TABLE[audience])
        .update({ emailed_at: null, email_attempts: data.email_attempts + 1 })
        .eq("id", id);
      if (updateError) throw new Error("Unable to release the notification email.");
    },
  };
}
