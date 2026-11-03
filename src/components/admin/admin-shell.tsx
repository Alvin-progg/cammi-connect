import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";

import { ADMIN_NAV_ITEMS, type AdminSection } from "./nav-items";

export type { AdminSection };

const SECTION_LABEL = "Administration";

/** A breadcrumb step after "Administration". The last one is the current page. */
export type AdminCrumb = { label: string; href?: string };

/**
 * Page frame for /admin (design.md §6.7): a 240px sidebar listing every admin
 * section and a 64px top bar holding the breadcrumb, the signed-in admin, and
 * sign-out. Below `lg` the sidebar stacks above the content as a top section,
 * so navigation is never hidden behind a control. The page heading is the
 * last breadcrumb.
 */
export function AdminShell({
  adminName,
  active,
  crumbs,
  children,
}: {
  adminName: string;
  active: AdminSection;
  crumbs: [...AdminCrumb[], AdminCrumb];
  children: ReactNode;
}) {
  const heading = crumbs[crumbs.length - 1].label;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas lg:flex-row">
      <aside className="flex flex-col border-b border-line bg-surface lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex min-h-16 items-center px-4 lg:px-5">
          <Link
            href="/"
            className="rounded-lg text-base font-semibold tracking-tight text-ink focus-ring"
          >
            CamiConnect
          </Link>
        </div>
        <nav aria-label={SECTION_LABEL} className="px-2 pb-2 lg:flex-1 lg:py-2">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {ADMIN_NAV_ITEMS.map((item) => {
              const current = item.key === active;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={clsx(
                      "focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-snappy motion-reduce:transition-none",
                      current
                        ? // design.md §5.6: a 2px rule as well as the tint, so the
                          // active item is not marked by colour alone. It sits under
                          // the item in the stacked layout and to its left at `lg`.
                          "bg-primary-soft text-primary shadow-[inset_0_-2px_0_var(--color-primary)] lg:shadow-[inset_2px_0_0_var(--color-primary)]"
                        : "text-ink-secondary hover:bg-surface-muted hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              <li className="text-ink-secondary">{SECTION_LABEL}</li>
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <li key={crumb.label} className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-ink-muted">
                      /
                    </span>
                    {last || !crumb.href ? (
                      <span
                        aria-current={last ? "page" : undefined}
                        className={last ? "font-medium text-ink" : "text-ink-secondary"}
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <Link
                        href={crumb.href}
                        className="rounded text-ink-secondary underline-offset-4 focus-ring hover:text-ink hover:underline"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-ink-secondary sm:inline">
              {adminName}
            </span>
            <SignOutButton />
          </div>
        </header>
        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{heading}</h1>
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
