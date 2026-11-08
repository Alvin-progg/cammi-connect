"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { RAIL_ITEM_BASE as ITEM_BASE, RailLabel, initialsOf } from "@/components/ui/rail";
import { BrandMark } from "@/components/ui/brand-mark";
import { DOCTOR_VIEW_PATHS, doctorViewForPath, type DoctorView } from "@/lib/appointments/dashboard";
import { signOutAction } from "@/server/auth/actions";

import { CalendarIcon, ChartColumnIcon, ChevronRightIcon, ClipboardListIcon, LogOutIcon } from "lucide-react";

type RailItem = {
  label: string;
  href: string;
  views: DoctorView[];
  icon: (props: { className?: string }) => React.ReactNode;
};

const RAIL_ITEMS: RailItem[] = [
  {
    label: "Appointments",
    href: DOCTOR_VIEW_PATHS.week,
    views: ["week"],
    icon: ClipboardListIcon,
  },
  {
    label: "Availability",
    href: DOCTOR_VIEW_PATHS.calendar,
    views: ["calendar"],
    icon: CalendarIcon,
  },
  {
    label: "Statistics",
    href: DOCTOR_VIEW_PATHS.stats,
    views: ["stats"],
    icon: ChartColumnIcon,
  },
];

/**
 * Doctor workspace navigation as a narrow icon rail. The toggle expands it to
 * show labels; on small screens the expanded rail overlays the page instead
 * of squeezing it. The doctor's profile and sign-out live at the bottom.
 */
export function DoctorRail({
  doctorName,
  specialty,
}: {
  doctorName: string;
  specialty: string | null;
}) {
  const activeView = doctorViewForPath(usePathname());
  const [expanded, setExpanded] = useState(false);
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
            className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-xl"
          >
            <BrandMark className="size-9" />
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
        </nav>

        <div className="flex flex-col gap-1 border-t border-line px-2.5 py-3">
          <Link
            href={DOCTOR_VIEW_PATHS.profile}
            aria-current={profileActive ? "page" : undefined}
            className={`${ITEM_BASE} px-2 ${
              profileActive ? "bg-primary-soft" : "hover:bg-surface-muted"
            }`}
          >
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
            >
              {initialsOf(doctorName, "DR")}
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
              <LogOutIcon className="size-5 shrink-0" />
              <RailLabel expanded={expanded}>Sign out</RailLabel>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
