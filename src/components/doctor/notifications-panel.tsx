import { formatManilaDateTime } from "@/lib/appointments/format";
import {
  NOTIFICATION_TYPE_LABELS,
  type AppointmentReminder,
  type DoctorNotification,
  type NotificationType,
} from "@/lib/notifications/types";

import { BellIcon } from "./icons";
import { MarkAllReadButton, MarkReadButton } from "./notification-actions";

const TYPE_TONES: Record<NotificationType, string> = {
  new_request: "border-warning/30 bg-warning-soft text-warning-soft-ink",
  cancelled: "border-danger/30 bg-danger-soft text-danger-soft-ink",
  rescheduled: "border-primary/30 bg-primary-soft text-primary",
  reminder: "border-accent/30 bg-accent-soft text-accent",
};

/**
 * Notification center body, shown inside the notifications modal: computed
 * next-24-hour reminders on top, then the persisted notification feed (new
 * requests, cancellations, reschedules). The modal supplies the h2 title.
 */
export function NotificationsPanel({
  notifications,
  reminders,
}: {
  notifications: DoctorNotification[];
  reminders: AppointmentReminder[];
}) {
  const unreadCount = notifications.filter(
    (notification) => notification.readAt === null,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="reminders-heading"
        className="rounded-xl border border-accent/30 bg-accent-soft p-4 sm:p-5"
      >
        <h3
          id="reminders-heading"
          className="text-base font-semibold text-ink"
        >
          Upcoming consultations (next 24 hours)
        </h3>
        {reminders.length === 0 ? (
          <p className="mt-2 text-sm text-ink-secondary">
            No confirmed consultations in the next 24 hours.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {reminders.map((reminder) => (
              <li
                key={reminder.appointmentId}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-surface px-3 py-2"
              >
                <BellIcon className="size-4 text-accent" />
                <span className="text-sm font-medium text-ink">
                  {reminder.patientName}
                </span>
                <time
                  dateTime={reminder.scheduledAt}
                  className="text-sm text-ink-secondary"
                >
                  {formatManilaDateTime(reminder.scheduledAt)} PHT
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notifications-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3
            id="notifications-heading"
            className="text-base font-semibold text-ink"
          >
            Recent activity
            {unreadCount > 0 ? (
              <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 align-middle text-xs font-semibold tabular-nums text-primary-ink">
                {unreadCount}
              </span>
            ) : null}
          </h3>
          {unreadCount > 0 ? <MarkAllReadButton /> : null}
        </div>

        {notifications.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-sm text-ink-muted">
            No notifications yet. New requests, cancellations, and reschedules
            will appear here.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {notifications.map((notification) => {
              const unread = notification.readAt === null;
              return (
                <li
                  key={notification.id}
                  className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
                    unread
                      ? "border-line-strong bg-surface"
                      : "border-line bg-surface-muted/60"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        unread ? "bg-primary" : "bg-transparent"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TYPE_TONES[notification.type]}`}
                        >
                          {NOTIFICATION_TYPE_LABELS[notification.type]}
                        </span>
                        <time
                          dateTime={notification.createdAt}
                          className="text-xs text-ink-muted"
                        >
                          {formatManilaDateTime(notification.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm font-medium text-ink">
                        {notification.title}
                      </p>
                      {notification.body ? (
                        <p className="mt-0.5 text-sm leading-6 text-ink-secondary">
                          {notification.body}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {unread ? (
                    <MarkReadButton notificationId={notification.id} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
