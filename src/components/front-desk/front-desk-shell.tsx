import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";

const SECTION_LABEL = "Front desk";

const NAV_ITEMS = [
  { key: "overview", href: "/front-desk", label: "Overview" },
  { key: "requests", href: "/front-desk/requests", label: "Requests" },
  { key: "schedule", href: "/front-desk/schedule", label: "Daily schedule" },
  { key: "book", href: "/front-desk/book", label: "New appointment" },
] as const;

export type FrontDeskSection = (typeof NAV_ITEMS)[number]["key"];

/** A breadcrumb step after "Front desk". The last one is the current page. */
export type FrontDeskCrumb = { label: string; href?: string };

/**
 * Page frame for /front-desk, following the administrator shell in design.md
 * §6.7: a 240px sidebar and a 64px top bar holding the breadcrumb, the
 * signed-in staff member, and sign-out. Below `lg` the sidebar stacks above
 * the content as a top section, so navigation is never hidden behind a
 * control. The page heading is the last breadcrumb.
 */
export function FrontDeskShell({
  staffName,
  active,
  crumbs,
  children,
}: {
  staffName: string;
  active: FrontDeskSection;
  crumbs: [...FrontDeskCrumb[], FrontDeskCrumb];
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
          <ul className="flex gap-1 lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const current = item.key === active;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`focus-ring flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-snappy motion-reduce:transition-none ${
                      current
                        ? "bg-primary-soft text-primary"
                        : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
                    }`}
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
            <span className="truncate text-sm text-ink-secondary">{staffName}</span>
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
