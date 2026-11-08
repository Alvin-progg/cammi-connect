"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { ChevronRightIcon, SignOutIcon, StethoscopeIcon, type IconProps } from "@/components/doctor/icons";
import { signOutAction } from "@/server/auth/actions";

import { RAIL_ITEM_BASE, RailLabel, initialsOf } from "./rail";

export type WorkspaceRailItem = {
  key: string;
  href: string;
  label: string;
  icon: (props: IconProps) => ReactNode;
};

/**
 * The staff workspace icon rail (admin and front desk), styled like the doctor
 * rail: sticky and full height, so it stays in place while the page scrolls.
 * The toggle expands it to show labels; below `lg` the expanded rail overlays
 * the page instead of squeezing it. The signed-in person and sign-out sit at
 * the foot. When the sections do not fit the screen height, the link list
 * scrolls on its own; there the collapsed tooltips are clipped, but every link
 * keeps its sr-only name.
 */
export function WorkspaceRail({
  navId,
  navLabel,
  homeHref,
  items,
  activeKey,
  personName,
  personRole,
  initialsFallback,
}: {
  navId: string;
  navLabel: string;
  homeHref: string;
  items: readonly WorkspaceRailItem[];
  activeKey: string;
  personName: string;
  personRole: string;
  initialsFallback: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {expanded ? <div aria-hidden="true" className="w-16 shrink-0 lg:hidden" /> : null}
      <aside
        className={`top-0 z-40 flex h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-snappy motion-reduce:transition-none ${
          expanded ? "fixed left-0 w-56 shadow-overlay lg:sticky lg:shadow-none" : "sticky w-16"
        }`}
      >
        <div className="relative flex h-16 shrink-0 items-center gap-3 px-3.5">
          <Link
            href={homeHref}
            aria-label={`CamiConnect ${navLabel.toLowerCase()} home`}
            className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-ink"
          >
            <StethoscopeIcon className="size-5" />
          </Link>
          {expanded ? (
            <span className="truncate text-base font-semibold tracking-tight text-ink">CamiConnect</span>
          ) : null}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={navId}
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
          id={navId}
          aria-label={navLabel}
          className="flex min-h-0 flex-1 flex-col gap-1 border-t border-line px-2.5 py-4 [@media(max-height:52rem)]:overflow-y-auto"
        >
          {items.map((item) => {
            const current = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`${RAIL_ITEM_BASE} ${
                  current ? "bg-primary-soft text-primary" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <item.icon className="size-5 shrink-0" />
                <RailLabel expanded={expanded}>{item.label}</RailLabel>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t border-line px-2.5 py-3">
          <div className={`${RAIL_ITEM_BASE} px-2 active:scale-100`}>
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
            >
              {initialsOf(personName, initialsFallback)}
            </span>
            {expanded ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{personName}</span>
                <span className="block truncate text-xs font-normal text-ink-muted">{personRole}</span>
              </span>
            ) : (
              <span className="sr-only">{personName}</span>
            )}
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className={`${RAIL_ITEM_BASE} w-full text-ink-muted hover:bg-danger-soft hover:text-danger-soft-ink`}
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
