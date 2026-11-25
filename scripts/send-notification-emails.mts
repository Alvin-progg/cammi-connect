#!/usr/bin/env node
/**
 * Notification email sweep (0047 outbox).
 *
 * Run with: npm run notifications:send-emails
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * and the SMTP variables (see db/README.md). Apply 0046 and 0047 first.
 *
 * The app emails notifications right after the action that wrote them. This
 * script covers rows no action dispatched, such as pg_cron payment expiries,
 * and retries failed sends. Schedule it every few minutes. Prints counts only,
 * never addresses or IDs.
 */
import { createClient } from "@supabase/supabase-js";

import { dispatchNotificationEmails } from "../src/lib/notifications/email.ts";
import { getMailEnv } from "../src/server/config.ts";
import { createNotificationEmailStore } from "../src/server/notifications/email-repository.ts";
import { createSmtpSender } from "../src/server/notifications/mailer.ts";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. See db/README.md.`);
  }
  return value;
}

async function main() {
  const mailEnv = getMailEnv();
  if (!mailEnv) {
    console.log("Email is off: no SMTP variables are set.");
    return;
  }

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const summary = await dispatchNotificationEmails({
    store: createNotificationEmailStore(supabase),
    send: createSmtpSender(mailEnv),
    baseUrl: mailEnv.appBaseUrl,
  });
  console.log(`Sent ${summary.sent}, skipped ${summary.skipped}, failed ${summary.failed}.`);
}

main().catch(() => {
  console.error("Notification email sweep failed.");
  process.exit(1);
});
