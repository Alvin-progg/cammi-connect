"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BellIcon } from "lucide-react";

import { cn } from "@/lib/cn";

const NotificationsContext = createContext<{
  open: () => void;
  isOpen: boolean;
} | null>(null);

/** Opens the notifications modal; both the header bell and the rail use it. */
export function useOpenNotifications(): () => void {
  return useNotificationsContext().open;
}

function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useOpenNotifications must be used inside NotificationsDialogProvider.",
    );
  }
  return context;
}

function notificationsLabel(unreadCount: number): string {
  return unreadCount > 0
    ? `Notifications, ${unreadCount} unread`
    : "Notifications";
}


/**
 * Hosts the notifications popover for the doctor workspace, anchored under
 * the header bell. Esc or a click outside closes it. The panel is
 * server-rendered with the page, so marking items read revalidates `/doctor`
 * and refreshes the open popover in place.
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
    <NotificationsContext.Provider
      value={{ open: openNotifications, isOpen }}
    >
      {children}
      <dialog
        ref={dialogRef}
        aria-label="Notifications"
        className="dialog-motion fixed top-[4.5rem] right-4 bottom-auto left-auto m-0 max-h-[min(40rem,calc(100dvh-5rem))] w-[420px] max-w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-transparent sm:right-6"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeNotifications();
          }
        }}
      >
        {isOpen ? panel : null}
      </dialog>
    </NotificationsContext.Provider>
  );
}

export function NotificationsBellButton({
  unreadCount,
}: {
  unreadCount: number;
}) {
  const { open: openNotifications, isOpen } = useNotificationsContext();

  return (
    <button
      type="button"
      onClick={openNotifications}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={notificationsLabel(unreadCount)}
      className={cn(
        "focus-ring relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border bg-surface transition-[color,background-color,transform] duration-150 ease-snappy hover:bg-surface-muted hover:text-ink active:scale-[0.95] motion-reduce:transition-none",
        isOpen ? "border-primary text-primary" : "border-line text-ink-secondary",
      )}
    >
      <BellIcon aria-hidden="true" className="size-4.5" />
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 inline-flex size-4.5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-ink ring-2 ring-surface"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
