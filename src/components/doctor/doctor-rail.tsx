"use client";

import Link from "next/link";
import { useState } from "react";

import type { DoctorView } from "@/lib/appointments/dashboard";
import { signOutAction } from "@/server/auth/actions";

import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  ChevronRightIcon,
  ClipboardIcon,
  SignOutIcon,
  StethoscopeIcon,
} from "./icons";
import { useOpenNotifications } from "./notifications-dialog";

type RailItem = {
  label: string;
  href: string;
  views: DoctorView[];
  icon: (props: { className?: string }) => React.ReactNode;
};

const RAIL_ITEMS: RailItem[] = [
  {
    label: "Appointments",
    href: "/doctor?view=week",
    views: ["week"],
    icon: ClipboardIcon,
  },
  {
    label: "Availability",
    href: "/doctor?view=calendar",
    views: ["calendar"],
    icon: CalendarIcon,
  },
  {
    label: "Statistics",
    href: "/doctor?view=stats",
    views: ["stats"],
    icon: ChartIcon,
  },
];

function initialsOf(name: string): string {
  const parts = name
    .replace(/^Dr\.\s*/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "DR";
}

/** Label shown inline when expanded, or as a hover/focus tooltip when collapsed. */
function RailLabel({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  if (expanded) {
    return <span className="truncate">{children}</span>;
  }
  return (
    <>
      <span className="sr-only">{children}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-50 origin-left -translate-y-1/2 scale-[0.97] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-canvas opacity-0 transition-[opacity,transform] duration-150 ease-snappy group-focus-visible:scale-100 group-focus-visible:opacity-100 motion-reduce:transition-none [@media(hover:hover)]:group-hover:scale-100 [@media(hover:hover)]:group-hover:opacity-100"
      >
        {children}
      </span>
    </>
  );
}

const ITEM_BASE =
  "group focus-ring relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[color,background-color,transform] duration-150 ease-snappy active:scale-[0.97] motion-reduce:transition-none";

/**
 * Doctor workspace navigation as a narrow icon rail. The toggle expands it to
 * show labels; on small screens the expanded rail overlays the page instead
 * of squeezing it. The doctor's profile and sign-out live at the bottom.
 */
export function DoctorRail({
  activeView,
  doctorName,
  specialty,
  unreadCount,
}: {
  activeView: DoctorView;
  doctorName: string;
  specialty: string | null;
  unreadCount: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const openNotifications = useOpenNotifications();
  const profileActive = activeView === "profile";

  return (
    <>
      {expanded ? (
        <div aria-hidden="true" className="w-16 shrink-0 lg:hidden" />
      ) : null}
      <aside
        className={`top-0 z-40 flex h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-snappy motion-reduce:transition-none ${
          expanded
            ? "fixed left-0 w-56 shadow-overlay lg:sticky lg:shadow-none"
            : "sticky w-16"
        }`}
      >
        <div className="relative flex h-16 shrink-0 items-center gap-3 px-3.5">
          <Link
            href="/doctor"
            aria-label="CamiConnect home"
            className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-ink"
          >
            <StethoscopeIcon className="size-5" />
          </Link>
          {expanded ? (
            <span className="truncate text-base font-semibold tracking-tight text-ink">
              CamiConnect
            </span>
          ) : null}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="doctor-rail-nav"
            aria-label={expanded ? "Collapse menu" : "Expand menu"}
            onClick={() => setExpanded((value) => !value)}
            className="focus-ring absolute -right-3 top-full z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-card transition-[color,transform] duration-150 ease-snappy hover:text-ink active:scale-[0.92] motion-reduce:transition-none"
          >
            <ChevronRightIcon
              className={`size-3.5 transition-transform duration-200 ease-snappy motion-reduce:transition-none ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        <nav
          id="doctor-rail-nav"
          aria-label="Doctor workspace"
          className="flex flex-1 flex-col gap-1 border-t border-line px-2.5 py-4"
        >
          {RAIL_ITEMS.map((item) => {
            const active = item.views.includes(activeView);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${ITEM_BASE} ${
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <item.icon className="size-5 shrink-0" />
                <RailLabel expanded={expanded}>{item.label}</RailLabel>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={openNotifications}
            aria-haspopup="dialog"
            className={`${ITEM_BASE} text-ink-muted hover:bg-surface-muted hover:text-ink`}
          >
            <span className="relative shrink-0">
              <BellIcon className="size-5" />
              {unreadCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-danger ring-2 ring-surface"
                />
              ) : null}
            </span>
            <RailLabel expanded={expanded}>
              Notifications
              {unreadCount > 0 ? (
                <span className="sr-only">, {unreadCount} unread</span>
              ) : null}
            </RailLabel>
            {unreadCount > 0 && expanded ? (
              <span
                aria-hidden="true"
                className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-ink"
              >
                {unreadCount}
              </span>
            ) : null}
          </button>
        </nav>

        <div className="flex flex-col gap-1 border-t border-line px-2.5 py-3">
          <Link
            href="/doctor?view=profile"
            aria-current={profileActive ? "page" : undefined}
            className={`${ITEM_BASE} px-2 ${
              profileActive ? "bg-primary-soft" : "hover:bg-surface-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
            >
              {initialsOf(doctorName)}
            </span>
            {expanded ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {doctorName}
                </span>
                <span className="block truncate text-xs font-normal text-ink-muted">
                  {specialty ?? "Doctor"}
                </span>
              </span>
            ) : (
              <RailLabel expanded={false}>{doctorName}</RailLabel>
            )}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className={`${ITEM_BASE} w-full text-ink-muted hover:bg-danger-soft hover:text-danger-soft-ink`}
            >
              <SignOutIcon className="size-5 shrink-0" />
              <RailLabel expanded={expanded}>Sign out</RailLabel>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
