"use client";

import { Check, ChevronLeft } from "lucide-react";
import { useOptimistic, useState, type ReactNode } from "react";

import { IconTile } from "@/components/ui/card";
import { Tabs } from "@/components/ui/navigation";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/notifications/relative-time";
import {
  NOTIFICATION_TYPE_LABELS,
  type AppointmentReminder,
  type DoctorNotification,
  type NotificationType,
} from "@/lib/notifications/types";

import {
  MarkAllReadButton,
  useMarkNotificationRead,
} from "./notification-actions";

type Filter = "unread" | "all";

const TYPE_ICONS: Record<
  NotificationType,
  { tone: "primary" | "warning" | "success"; glyph: ReactNode }
> = {
  new_request: { tone: "warning", glyph: "!" },
  confirmed: { tone: "success", glyph: <Check aria-hidden="true" /> },
  cancelled: { tone: "warning", glyph: "!" },
  rescheduled: { tone: "primary", glyph: "!" },
  reminder: { tone: "success", glyph: <Check aria-hidden="true" /> },
};

/**
 * Notification popover body (reference DoctorNotificationsScreen): header with
 * "Mark all as read", Unread/All tabs, then one list. Clicking a notification
 * opens its details in place and marks it read. Computed next-24-hour
 * reminders have no read state, so they show first on the All tab only.
 */
export function NotificationsPanel({
  notifications: savedNotifications,
  reminders,
}: {
  notifications: DoctorNotification[];
  reminders: AppointmentReminder[];
}) {
  // Read state flips at once; it reverts if the save fails, and the revalidated
  // props replace it when the save succeeds.
  const [notifications, markReadOptimistically] = useOptimistic(
    savedNotifications,
    (current, readId: string | "all") => {
      const readAt = new Date().toISOString();
      return current.map((notification) =>
        notification.readAt === null && (readId === "all" || notification.id === readId)
          ? { ...notification, readAt }
          : notification,
      );
    },
  );
  const unread = notifications.filter(
    (notification) => notification.readAt === null,
  );
  const [filter, setFilter] = useState<Filter>(
    unread.length > 0 ? "unread" : "all",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const markRead = useMarkNotificationRead(markReadOptimistically);

  // The panel mounts only while the popover is open, so this never runs on the server.
  const now = new Date();
  const shownNotifications = filter === "unread" ? unread : notifications;
  const shownReminders = filter === "all" ? reminders : [];
  const isEmpty = shownNotifications.length === 0 && shownReminders.length === 0;
  const openNotification =
    notifications.find((notification) => notification.id === openId) ?? null;

  function openDetails(notification: DoctorNotification) {
    setOpenId(notification.id);
    if (notification.readAt === null) {
      markRead(notification.id);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4.5 py-3.5">
        <h2 className="text-lg font-semibold text-ink">Notifications</h2>
        <MarkAllReadButton
          disabled={unread.length === 0}
          onOptimistic={() => markReadOptimistically("all")}
        />
      </div>

      {openNotification ? (
        <NotificationDetails
          notification={openNotification}
          now={now}
          onBack={() => setOpenId(null)}
        />
      ) : (
        <>
          <div className="px-3 pt-3">
            <Tabs
              label="Filter notifications"
              value={filter}
              onValueChange={(value) =>
                setFilter(value === "unread" ? "unread" : "all")
              }
              items={[
                { value: "unread", label: "Unread", count: unread.length },
                { value: "all", label: "All" },
              ]}
            />
          </div>

          {isEmpty ? (
            <p className="px-4.5 py-8 text-sm text-ink-muted">
              {filter === "unread"
                ? "No unread notifications."
                : "No notifications yet. New requests, cancellations, and reschedules will appear here."}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line px-4.5 pb-2">
              {shownReminders.map((reminder) => (
                <li
                  key={`reminder-${reminder.appointmentId}`}
                  className="flex items-start gap-3 py-3.5"
                >
                  <IconTile tone="success">
                    <Check aria-hidden="true" />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      Upcoming: {reminder.patientName}
                    </p>
                    <p className="text-[13px] text-ink-secondary">
                      <time dateTime={reminder.scheduledAt}>
                        {formatManilaDateTime(reminder.scheduledAt)} PHT
                      </time>
                    </p>
                  </div>
                </li>
              ))}
              {shownNotifications.map((notification) => {
                const isUnread = notification.readAt === null;
                const icon = TYPE_ICONS[notification.type];
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => openDetails(notification)}
                      className="focus-ring -mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-lg px-2 py-3.5 text-left transition-colors hover:bg-surface-muted"
                    >
                      <IconTile tone={icon.tone}>{icon.glyph}</IconTile>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-sm text-ink",
                            isUnread ? "font-semibold" : "font-medium",
                          )}
                        >
                          {notification.title}
                        </span>
                        {notification.body ? (
                          <span className="block truncate text-[13px] text-ink-secondary">
                            {notification.body}
                          </span>
                        ) : null}
                        <time
                          dateTime={notification.createdAt}
                          className="mt-1 block text-xs text-ink-muted"
                        >
                          {formatRelativeTime(notification.createdAt, now)}
                        </time>
                      </span>
                      {isUnread ? (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                          <span className="sr-only">Unread</span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function NotificationDetails({
  notification,
  now,
  onBack,
}: {
  notification: DoctorNotification;
  now: Date;
  onBack: () => void;
}) {
  const icon = TYPE_ICONS[notification.type];
  return (
    <div className="flex flex-col gap-4 px-4.5 py-3.5">
      <button
        type="button"
        autoFocus
        onClick={onBack}
        aria-label="Back to notifications"
        className="focus-ring -ml-1 inline-flex items-center gap-1 self-start rounded-md px-1 text-sm font-medium text-ink-secondary hover:text-ink"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Back
      </button>
      <div className="flex items-start gap-3">
        <IconTile tone={icon.tone}>{icon.glyph}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-muted">
            {NOTIFICATION_TYPE_LABELS[notification.type]}
          </p>
          <h3 className="text-base font-semibold text-ink">
            {notification.title}
          </h3>
        </div>
      </div>
      {notification.body ? (
        <p className="text-sm leading-6 text-ink-secondary">
          {notification.body}
        </p>
      ) : null}
      <p className="text-xs text-ink-muted">
        <time dateTime={notification.createdAt}>
          {formatManilaDateTime(notification.createdAt)} PHT
        </time>
        {" · "}
        {formatRelativeTime(notification.createdAt, now)}
      </p>
    </div>
  );
}
