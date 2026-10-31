"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BellIcon } from "./icons";

const OpenNotificationsContext = createContext<(() => void) | null>(null);

/** Opens the notifications modal; both the header bell and the rail use it. */
export function useOpenNotifications(): () => void {
  const openNotifications = useContext(OpenNotificationsContext);
  if (!openNotifications) {
    throw new Error(
      "useOpenNotifications must be used inside NotificationsDialogProvider.",
    );
  }
  return openNotifications;
}

function notificationsLabel(unreadCount: number): string {
  return unreadCount > 0
    ? `Notifications, ${unreadCount} unread`
    : "Notifications";
}


/**
 * Hosts the notifications modal for the doctor workspace. The panel is
 * server-rendered with the page, so marking items read revalidates `/doctor`
 * and refreshes the open modal in place.
 */
export function NotificationsDialogProvider({
  panel,
  children,
}: {
  panel: ReactNode;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openNotifications = useCallback(() => {
    setIsOpen(true);
    dialogRef.current?.showModal();
  }, []);
  const closeNotifications = () => dialogRef.current?.close();

  return (
    <OpenNotificationsContext.Provider value={openNotifications}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="notifications-dialog-title"
        className="m-auto max-h-[min(48rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-overlay"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeNotifications();
          }
        }}
      >
        {isOpen ? (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-4 sm:px-6">
              <h2
                id="notifications-dialog-title"
                className="text-xl font-semibold text-ink"
              >
                Notifications
              </h2>
              <button
                type="button"
                autoFocus
                onClick={closeNotifications}
                aria-label="Close notifications"
                className="focus-ring inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted motion-reduce:transition-none"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-5 sm:px-6">{panel}</div>
          </>
        ) : null}
      </dialog>
    </OpenNotificationsContext.Provider>
  );
}

export function NotificationsBellButton({
  unreadCount,
}: {
  unreadCount: number;
}) {
  const openNotifications = useOpenNotifications();

  return (
    <button
      type="button"
      onClick={openNotifications}
      aria-haspopup="dialog"
      aria-label={notificationsLabel(unreadCount)}
      className="focus-ring relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-secondary transition-[color,background-color,transform] duration-150 ease-snappy hover:bg-surface-muted hover:text-ink active:scale-[0.95] motion-reduce:transition-none"
    >
      <BellIcon className="size-5" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-2.5 top-2 size-2 rounded-full bg-danger ring-2 ring-surface"
        />
      ) : null}
    </button>
  );
}
