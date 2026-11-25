import "server-only";

import { after } from "next/server";

import { dispatchNotificationEmails, type SendMail } from "@/lib/notifications/email";
import { getMailEnv } from "@/server/config";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import { createNotificationEmailStore } from "./email-repository";
import { createSmtpSender } from "./mailer";

let cachedSend: SendMail | null = null;

/**
 * After the response is sent, emails the notification rows that the
 * database triggers wrote. Call it at the end of a successful action that may
 * have written notifications. Does nothing when SMTP is not configured.
 */
export function sendNotificationEmailsAfterResponse(): void {
  after(async () => {
    try {
      const env = getMailEnv();
      if (!env) return;
      cachedSend ??= createSmtpSender(env);
      await dispatchNotificationEmails({
        store: createNotificationEmailStore(getSupabaseAdminClient()),
        send: cachedSend,
        baseUrl: env.appBaseUrl,
      });
    } catch {
      // Fixed text only: provider errors can echo addresses or credentials.
      console.error("Notification email dispatch failed.");
    }
  });
}
