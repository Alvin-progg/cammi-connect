import "server-only";

import nodemailer from "nodemailer";

// Type-only imports: scripts/send-notification-emails.mts loads this file with
// plain Node, which cannot resolve the @/ alias.
import type { SendMail } from "@/lib/notifications/email";
import type { MailEnv } from "@/server/config";

/** SMTP sender for notification emails. Create once per process. */
export function createSmtpSender(env: MailEnv): SendMail {
  const transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    // Port 465 is implicit TLS; other ports upgrade with STARTTLS.
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
  return async (message) => {
    await transport.sendMail({ from: env.mailFrom, ...message });
  };
}
