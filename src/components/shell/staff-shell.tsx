import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/navigation";
import { initialsOf } from "@/components/ui/rail";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/server/auth/actions";

export type StaffNavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  group?: string;
  count?: number;
};

export type StaffCrumb = { label: string; href?: string };

/** Splits a flat, ordered item list into consecutive groups by `group`. */
function groupItems(items: readonly StaffNavItem[]) {
  const groups: { label?: string; items: StaffNavItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.label === item.group) last.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  }
  return groups;
}

/**
 * The staff sidebar (admin and front desk): grouped 240px column that stays
 * in view on large screens and stacks above the page below `lg`.
 */
function StaffSidebar({
  navLabel,
  roleLabel,
  homeHref,
  items,
  activeKey,
  personName,
  personRole,
  initialsFallback,
  search,
}: {
  navLabel: string;
  roleLabel: string;
  homeHref: string;
  items: readonly StaffNavItem[];
  activeKey: string;
  personName: string;
  personRole: string;
  initialsFallback: string;
  search?: ReactNode;
}) {
  return (
    <aside className="flex w-full flex-col gap-0.5 border-line bg-surface px-3 py-4 print:hidden lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r">
      <Link
        href={homeHref}
        aria-label={`CamiConnect ${navLabel.toLowerCase()} home`}
        className="focus-ring mb-1 flex items-center gap-2.5 rounded-lg px-2 py-1"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-ink"
        >
          C
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">CamiConnect</span>
      </Link>
      <p className="px-2 pb-2 text-xs text-ink-muted">{roleLabel}</p>
      {search ? <div className="mb-2">{search}</div> : null}
      <nav aria-label={navLabel} className="flex flex-col gap-0.5 overflow-y-auto">
        {groupItems(items).map((group, index) => (
          <div key={group.label ?? index} className="flex flex-col gap-0.5">
            {group.label ? <p className="px-3 pb-1 pt-3.5 text-xs font-medium text-ink-muted">{group.label}</p> : null}
            {group.items.map((item) => {
              const current = item.key === activeKey;
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "focus-ring flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors motion-reduce:transition-none",
                    current
                      ? "bg-primary-soft font-medium text-primary-hover"
                      : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count ? (
                    <span className="min-w-5.5 rounded-full bg-primary px-1.5 text-center text-xs text-primary-ink">
                      <span className="sr-only">(</span>
                      {item.count}
                      <span className="sr-only"> waiting)</span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-line px-2 pt-3">
        <Avatar initials={initialsOf(personName, initialsFallback)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{personName}</p>
          <p className="text-xs text-ink-muted">{personRole}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="focus-ring inline-flex size-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-danger-soft hover:text-danger-soft-ink"
          >
            <LogOut aria-hidden="true" className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}

/**
 * Admin and front-desk page frame: sidebar, a top bar with the breadcrumb and
 * page actions, then the page title and body. The page heading is the last
 * breadcrumb.
 */
export function StaffShell({
  navLabel,
  roleLabel,
  homeHref,
  items,
  activeKey,
  personName,
  personRole,
  initialsFallback,
  rootCrumb,
  crumbs,
  title,
  badges,
  lead,
  actions,
  search,
  children,
}: {
  navLabel: string;
  roleLabel: string;
  homeHref: string;
  items: readonly StaffNavItem[];
  activeKey: string;
  personName: string;
  personRole: string;
  initialsFallback: string;
  rootCrumb: StaffCrumb;
  crumbs: [...StaffCrumb[], StaffCrumb];
  /** Page title when it differs from the last breadcrumb. */
  title?: ReactNode;
  badges?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  search?: ReactNode;
  children: ReactNode;
}) {
  const heading = title ?? crumbs[crumbs.length - 1].label;
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas lg:flex-row">
      <StaffSidebar
        navLabel={navLabel}
        roleLabel={roleLabel}
        homeHref={homeHref}
        items={items}
        activeKey={activeKey}
        personName={personName}
        personRole={personRole}
        initialsFallback={initialsFallback}
        search={search}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8 print:hidden">
          <Breadcrumb items={[rootCrumb, ...crumbs]} />
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        <main id="main" className="flex flex-col gap-6 px-4 pb-12 pt-6 sm:px-8">
          <PageHeader title={heading} badges={badges} lead={lead} />
          {children}
        </main>
      </div>
    </div>
  );
}

/** Page title block: optional eyebrow and badges, title, lead, right-side slot. */
export function PageHeader({
  title,
  lead,
  badges,
  aside,
  eyebrow,
}: {
  title: ReactNode;
  lead?: ReactNode;
  badges?: ReactNode;
  aside?: ReactNode;
  eyebrow?: string;
}) {
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
