import Link from "next/link";

import { BellIcon } from "./icons";

/**
 * Slim workspace header: view title and a notifications shortcut. Search,
 * the period dropdown, and the profile block were removed in the 2026-10-27
 * redesign; the profile now lives in the navigation rail.
 */
export function DoctorHeader({
  title,
  todayLabel,
  unreadCount,
}: {
  title: string;
  todayLabel: string;
  unreadCount: number;
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="hidden truncate text-sm text-ink-muted sm:block">
            {todayLabel} · PHT
          </p>
        </div>
        <Link
          href="/doctor?view=notifications"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className="focus-ring relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-secondary transition-[color,background-color,transform] duration-150 ease-snappy hover:bg-surface-muted hover:text-ink active:scale-[0.95] motion-reduce:transition-none"
        >
          <BellIcon className="size-5" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-2.5 top-2 size-2 rounded-full bg-danger ring-2 ring-surface"
            />
          ) : null}
        </Link>
      </div>
    </header>
  );
}
