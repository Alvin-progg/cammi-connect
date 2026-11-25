export type NotificationAudience = "patient" | "doctor";

export type NotificationEmail = {
  subject: string;
  text: string;
  html: string;
};

const BENEFIT_TYPES = new Set([
  "pwd_verified",
  "pwd_rejected",
  "hmo_membership_verified",
  "hmo_membership_rejected",
]);

/** Where the email's button leads: the page that shows this notification's details. */
export function notificationEmailPath(audience: NotificationAudience, type: string): string {
  if (audience === "doctor") return "/doctor";
  return BENEFIT_TYPES.has(type) ? "/account/benefits" : "/chat?view=appointments";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Plain email for one notification row. The title and body are the fixed,
 * trigger-written texts (0029, 0044, 0047), so the email carries no more
 * detail than the in-app bell.
 */
export function renderNotificationEmail(input: {
  audience: NotificationAudience;
  type: string;
  title: string;
  body: string;
  baseUrl: string;
}): NotificationEmail {
  const link = `${input.baseUrl}${notificationEmailPath(input.audience, input.type)}`;
  const title = input.title.replace(/[\r\n]+/g, " ");

  const text = [title, input.body, "", `Open CamiConnect: ${link}`].join("\n");
  const html = `<!doctype html>
<html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5">
<h2 style="margin:0 0 8px">${escapeHtml(title)}</h2>
<p style="margin:0 0 16px">${escapeHtml(input.body)}</p>
<p><a href="${escapeHtml(link)}" style="background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open CamiConnect</a></p>
<p style="color:#6b7280;font-size:12px">This is an automated message from CamiConnect. Please do not reply.</p>
</body></html>`;

  return { subject: `${title} · CamiConnect`, text, html };
}

export type PendingNotificationEmail = {
  audience: NotificationAudience;
  id: string;
  recipientProfileId: string;
  type: string;
  title: string;
  body: string;
};

/**
 * Notification rows used as an email outbox (0047). Implemented by
 * src/server/notifications/email-repository.ts and by
 * scripts/send-notification-emails.mts.
 */
export interface NotificationEmailStore {
  listPending(limit: number): Promise<PendingNotificationEmail[]>;
  /** The sign-in email of an active profile, or null when there is none. */
  findRecipientEmail(profileId: string): Promise<string | null>;
  /** Sets emailed_at only if still unset; false when another run got it first. */
  claim(audience: NotificationAudience, id: string): Promise<boolean>;
  /** Clears emailed_at and counts the failed attempt, so a later run retries. */
  release(audience: NotificationAudience, id: string): Promise<void>;
}

export type SendMail = (message: { to: string } & NotificationEmail) => Promise<void>;

export type DispatchSummary = { sent: number; skipped: number; failed: number };

const DISPATCH_BATCH_SIZE = 50;

/**
 * Emails pending notifications. Each row is claimed before sending, so two
 * overlapping runs never send the same email twice; a failed lookup or send
 * releases it for a retry. The I/O is injected, so this stays pure and testable.
 */
export async function dispatchNotificationEmails({
  store,
  send,
  baseUrl,
}: {
  store: NotificationEmailStore;
  send: SendMail;
  baseUrl: string;
}): Promise<DispatchSummary> {
  const summary: DispatchSummary = { sent: 0, skipped: 0, failed: 0 };

  for (const row of await store.listPending(DISPATCH_BATCH_SIZE)) {
    if (!(await store.claim(row.audience, row.id))) {
      summary.skipped += 1;
      continue;
    }

    try {
      // Claimed with no address: stays marked, since retrying cannot help.
      const to = await store.findRecipientEmail(row.recipientProfileId);
      if (!to) {
        summary.skipped += 1;
        continue;
      }

      await send({ to, ...renderNotificationEmail({ ...row, baseUrl }) });
      summary.sent += 1;
    } catch {
      await store.release(row.audience, row.id);
      summary.failed += 1;
    }
  }

  return summary;
}
