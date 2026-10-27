import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import type { DepartmentColleague } from "@/server/profiles/service";
import type { DoctorView } from "@/lib/appointments/dashboard";

import {
  BellIcon,
  BoardIcon,
  CalendarIcon,
  ChartIcon,
  ListIcon,
  StethoscopeIcon,
  UserIcon,
} from "./icons";

type SidebarNavItem = {
  view: DoctorView;
  label: string;
  icon: (props: { className?: string }) => React.ReactNode;
};

const NAV_ITEMS: SidebarNavItem[] = [
  { view: "board", label: "Board", icon: BoardIcon },
  { view: "list", label: "Appointments", icon: ListIcon },
  { view: "calendar", label: "Schedule", icon: CalendarIcon },
  { view: "notifications", label: "Notifications", icon: BellIcon },
  { view: "stats", label: "Statistics", icon: ChartIcon },
  { view: "profile", label: "Profile", icon: UserIcon },
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

function CountBadge({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }
  return (
    <span className="ml-auto inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary-ink">
      {count}
    </span>
  );
}

export function DoctorSidebar({
  activeView,
  doctorName,
  specialty,
  departmentName,
  colleagues,
  todayCount,
  unreadCount,
}: {
  activeView: DoctorView;
  doctorName: string;
  specialty: string | null;
  departmentName: string | null;
  colleagues: DepartmentColleague[];
  todayCount: number;
  unreadCount: number;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary"
        >
          <StethoscopeIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <Link
            href="/"
            className="block truncate rounded-lg text-base font-semibold tracking-tight text-ink focus-ring"
          >
            CamiConnect
          </Link>
          <p className="truncate text-xs text-ink-muted">Doctor workspace</p>
        </div>
      </div>

      <nav aria-label="Doctor workspace" className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-2 text-xs font-medium text-ink-muted">Main menu</p>
        <ul className="mt-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.view === activeView;
            const badgeCount =
              item.view === "board"
                ? todayCount
                : item.view === "notifications"
                  ? unreadCount
                  : 0;
            return (
              <li key={item.view}>
                <Link
                  href={`/doctor?view=${item.view}`}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium focus-ring ${
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                    />
                  ) : null}
                  <item.icon className="size-5" />
                  <span className="truncate">{item.label}</span>
                  <CountBadge count={badgeCount} />
                </Link>
              </li>
            );
          })}
        </ul>

        {departmentName ? (
          <div className="mt-8">
            <p className="px-2 text-xs font-medium text-ink-muted">
              {departmentName}
            </p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {colleagues.length === 0 ? (
                <li className="px-3 py-2 text-sm text-ink-muted">
                  No other doctors in this department.
                </li>
              ) : (
                colleagues.map((colleague) => (
                  <li
                    key={colleague.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
                    >
                      {initialsOf(colleague.fullName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {colleague.fullName}
                      </span>
                      {colleague.specialty ? (
                        <span className="block truncate text-xs text-ink-muted">
                          {colleague.specialty}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </nav>

      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
          >
            {initialsOf(doctorName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {doctorName}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {specialty ?? "Doctor"}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
