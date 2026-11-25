"use client";

import { BellIcon } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/notifications/relative-time";
import { PATIENT_NOTIFICATION_TYPE_LABELS, type PatientNotification } from "@/lib/notifications/types";
import {
  markAllPatientNotificationsReadAction,
  markPatientNotificationReadAction,
  type PatientNotificationActionState,
} from "@/server/notifications/patient-actions";

const IDLE_STATE: PatientNotificationActionState = { status: "idle" };

// Matches the sidebar rows in chat-sidebar.tsx.
const ROW =
  "focus-ring flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink motion-reduce:transition-none";
const ICON_SLOT = "inline-flex size-8 shrink-0 items-center justify-center";

/**
 * The sidebar's Notifications row and its popover. Unread items show a
 * "Mark as read" action; the list mounts only while open, so the relative
 * times are computed in the browser and cannot mismatch the server render.
 */
export function PatientNotificationsPanel({
  notifications,
}: {
  notifications: PatientNotification[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((item) => item.readAt === null).length;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          dialogRef.current?.showModal();
        }}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className={ROW}
      >
        <span className={cn(ICON_SLOT, "relative")}>
          <BellIcon aria-hidden="true" className="size-5" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-white"
            >
              {unreadCount}
            </span>
          ) : null}
        </span>
        <span className="truncate whitespace-nowrap opacity-0 transition-opacity duration-150 motion-reduce:transition-none group-data-[state=open]:opacity-100 md:group-data-[state=auto]:opacity-100">
          Notifications
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Notifications"
        className="fixed top-20 left-4 m-0 max-h-[min(40rem,calc(100dvh-6rem))] w-[360px] max-w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-transparent"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {isOpen ? (
          <NotificationList
            notifications={notifications}
            unreadCount={unreadCount}
            onClose={() => dialogRef.current?.close()}
          />
        ) : null}
      </dialog>
    </>
  );
}

function NotificationList({
  notifications,
  unreadCount,
  onClose,
}: {
  notifications: PatientNotification[];
  unreadCount: number;
  onClose: () => void;
}) {
  const [markAllState, markAllAction, markAllPending] = useActionState(
    markAllPatientNotificationsReadAction,
    IDLE_STATE,
  );
  const [markOneState, markOneAction] = useActionState(
    markPatientNotificationReadAction,
    IDLE_STATE,
  );
  const error = markAllState.status === "error" ? markAllState : markOneState.status === "error" ? markOneState : null;
  const now = new Date();

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-ink">Notifications</h2>
        <div className="flex items-center gap-2">
          <form action={() => markAllAction()}>
            <button
              type="submit"
              disabled={unreadCount === 0 || markAllPending}
              aria-busy={markAllPending}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {markAllPending ? "Updating…" : "Mark all as read"}
            </button>
          </form>
          <button type="button" onClick={onClose} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Close
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="px-4 pt-3 text-sm text-danger-soft-ink">
          {error.message}
        </p>
      ) : null}

      {notifications.length === 0 ? (
        <p className="px-4 py-8 text-sm text-ink-muted">
          No notifications yet. Updates on your requests and payments will appear here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line px-4 pb-2">
          {notifications.map((notification) => {
            const isUnread = notification.readAt === null;
            return (
              <li key={notification.id} className="flex items-start gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                    {PATIENT_NOTIFICATION_TYPE_LABELS[notification.type]} ·{" "}
                    {formatRelativeTime(notification.createdAt, now)}
                  </p>
                  <p className={cn("text-sm text-ink", isUnread ? "font-semibold" : "font-medium")}>
                    {notification.title}
                  </p>
                  {notification.body ? (
                    <p className="text-[13px] text-ink-secondary">{notification.body}</p>
                  ) : null}
                </div>
                {isUnread ? (
                  <form action={markOneAction}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button type="submit" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Mark as read
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
