import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Search,
  Settings,
  Stethoscope,
  Tags,
  UserRound,
  Users,
  CalendarPlus,
  ListChecks,
  Bell,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/navigation";
import { href } from "@/lib/routes";
import { cn } from "@/lib/cn";

type NavItem = { label: string; path: string; icon: LucideIcon; count?: number };
type NavGroup = { label?: string; items: NavItem[] };

/**
 * Admin navigation, grouped (decision: grouped 240px sidebar replaces the
 * 13-item icon rail). Paths match the repo's /admin/<section> routes.
 */
export const ADMIN_NAV: NavGroup[] = [
  { label: "Overview", items: [
    { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { label: "Analytics", path: "/admin/analytics", icon: BarChart3 },
  ] },
  { label: "Operations", items: [
    { label: "Appointments", path: "/admin/appointments", icon: CalendarDays },
    { label: "Schedules", path: "/admin/schedules", icon: CalendarClock },
  ] },
  { label: "Directory", items: [
    { label: "Doctors", path: "/admin/doctors", icon: Stethoscope },
    { label: "Departments", path: "/admin/departments", icon: Building2 },
    { label: "Specialties", path: "/admin/specialties", icon: Tags },
    { label: "Services", path: "/admin/services", icon: ClipboardList },
    { label: "Requirements", path: "/admin/requirements", icon: FileCheck2 },
  ] },
  { label: "Chatbot", items: [{ label: "Knowledge base", path: "/admin/knowledge-base", icon: BookOpen }] },
  { label: "System", items: [
    { label: "Users", path: "/admin/users", icon: Users },
    { label: "Settings", path: "/admin/settings", icon: Settings },
    { label: "Audit log", path: "/admin/audit-log", icon: ScrollText },
  ] },
];

export const FRONT_DESK_NAV: NavGroup[] = [
  { items: [
    { label: "Overview", path: "/front-desk", icon: LayoutDashboard },
    { label: "Requests", path: "/front-desk/requests", icon: ListChecks, count: 7 },
    { label: "Daily schedule", path: "/front-desk/schedule", icon: CalendarDays },
    { label: "New appointment", path: "/front-desk/book", icon: CalendarPlus },
  ] },
];

function Sidebar({ role, nav, active, person, search }: { role: string; nav: NavGroup[]; active: string; person: { name: string; role: string }; search?: boolean }) {
  return (
    <aside aria-label={`${role} navigation`} className="flex w-full flex-col gap-0.5 border-line bg-surface px-3 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r">
      <a href={href(nav[0].items[0].path)} className="focus-ring mb-1 flex items-center gap-2.5 rounded-lg px-2 py-1">
        <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-ink">C</span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">CamiConnect</span>
      </a>
      <p className="px-2 pb-2 text-xs text-ink-muted">{role}</p>
      {search ? (
        <a href="#palette" className="focus-ring mb-2 flex h-9 items-center gap-2 rounded-md border border-control-line px-3 text-sm text-ink-muted shadow-soft">
          <Search aria-hidden className="size-4" />
          <span className="flex-1">Find patient</span>
          <kbd className="rounded border border-line-strong px-1.5 font-mono text-[11px] text-ink-secondary">⌘K</kbd>
        </a>
      ) : null}
      <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {nav.map((group, gi) => (
          <div key={group.label ?? gi} className="flex flex-col gap-0.5">
            {group.label ? <p className="px-3 pb-1 pt-3.5 text-xs font-medium text-ink-muted">{group.label}</p> : null}
            {group.items.map((item) => {
              const current = item.path === active;
              const Icon = item.icon;
              return (
                <a
                  key={item.path}
                  href={href(item.path)}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "focus-ring flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                    current ? "bg-primary-soft font-medium text-primary-hover" : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count ? <span className="min-w-5.5 rounded-full bg-primary px-1.5 text-center text-xs text-primary-ink">{item.count}</span> : null}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2 pt-3">
        <Avatar initials={person.name.split(" ").map((p) => p[0]).slice(0, 2).join("")} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{person.name}</p>
          <p className="text-xs text-ink-muted">{person.role}</p>
        </div>
        <a href={href("/login")} aria-label="Sign out" className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-muted">
          <LogOut aria-hidden className="size-4" />
        </a>
      </div>
    </aside>
  );
}

/**
 * Admin and front-desk layout: sidebar, a top bar with breadcrumb and page
 * actions, then the page body. Below `lg` the sidebar stacks above the page.
 */
export function StaffShell({
  workspace,
  active,
  crumbs,
  actions,
  children,
}: {
  workspace: "admin" | "front-desk";
  active: string;
  crumbs: { label: string; href?: string }[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const admin = workspace === "admin";
  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      <Sidebar
        role={admin ? "Administrator" : "Front desk"}
        nav={admin ? ADMIN_NAV : FRONT_DESK_NAV}
        active={active}
        person={admin ? { name: "Maria Santos", role: "Admin" } : { name: "Rosa Garcia", role: "Front desk" }}
        search={!admin}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8">
          <Breadcrumb items={crumbs} />
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        <main className="flex flex-col gap-6 px-4 pb-12 pt-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

/** Page title block: optional eyebrow and badges, title, lead, right-side slot. */
export function PageHeader({ title, lead, badges, aside, eyebrow }: { title: ReactNode; lead?: ReactNode; badges?: ReactNode; aside?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm font-medium text-primary">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
          {badges}
        </div>
        {lead ? <p className="mt-1 text-sm text-ink-secondary sm:text-base">{lead}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/** Two-column detail layout: main column and a narrower side column. */
export function SplitLayout({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">{main}</div>
      <div className="flex min-w-0 flex-col gap-4">{side}</div>
    </div>
  );
}

const DOCTOR_NAV: NavItem[] = [
  { label: "Appointments", path: "/doctor", icon: CalendarDays },
  { label: "Availability", path: "/doctor/availability", icon: CalendarClock },
  { label: "Statistics", path: "/doctor/stats", icon: BarChart3 },
  { label: "Profile", path: "/doctor/profile", icon: UserRound },
];

/**
 * Doctor workspace: keeps the compact 64px rail (the doctor works one dense
 * screen). In the repo these are `/doctor?view=…`, not separate routes.
 */
export function DoctorShell({ active, title, actions, children, notificationsOpen }: { active: string; title: ReactNode; actions?: ReactNode; children: ReactNode; notificationsOpen?: boolean }) {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <nav aria-label="Doctor workspace" className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
        <span aria-hidden className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-primary font-semibold text-primary-ink">C</span>
        {DOCTOR_NAV.map((item) => {
          const current = item.path === active;
          const Icon = item.icon;
          return (
            <a
              key={item.path}
              href={href(item.path)}
              aria-label={item.label}
              title={item.label}
              aria-current={current ? "page" : undefined}
              className={cn("focus-ring inline-flex size-12 items-center justify-center rounded-xl", current ? "bg-primary-soft text-primary" : "text-ink-secondary hover:bg-surface-muted")}
            >
              <Icon aria-hidden className="size-5" />
            </a>
          );
        })}
        <Avatar initials="AR" className="mt-auto" />
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-7">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <div className="flex items-center gap-3">
            {actions}
            <a
              href={href("/doctor/notifications")}
              aria-label="Notifications, 3 new"
              aria-expanded={notificationsOpen}
              className={cn("focus-ring relative inline-flex size-10 items-center justify-center rounded-lg border bg-surface", notificationsOpen ? "border-primary text-primary" : "border-line text-ink-secondary")}
            >
              <Bell aria-hidden className="size-4.5" />
              <span aria-hidden className="absolute -right-1.5 -top-1.5 inline-flex size-4.5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-ink">3</span>
            </a>
            <div className="hidden items-center gap-2.5 sm:flex">
              <Avatar initials="AR" />
              <div>
                <p className="text-sm font-medium text-ink">Dr. Ana Reyes</p>
                <p className="text-xs text-ink-muted">Pediatrics</p>
              </div>
            </div>
          </div>
        </header>
        <main className="relative flex flex-1 flex-col gap-6 px-4 pb-10 pt-6 sm:px-7">{children}</main>
      </div>
    </div>
  );
}
