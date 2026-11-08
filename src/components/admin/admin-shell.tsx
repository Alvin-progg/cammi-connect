import Link from "next/link";
import type { ReactNode } from "react";

import { AdminRail } from "./admin-rail";
import type { AdminSection } from "./nav-items";

export type { AdminSection };

const SECTION_LABEL = "Administration";

/** A breadcrumb step after "Administration". The last one is the current page. */
export type AdminCrumb = { label: string; href?: string };

/**
 * Page frame for /admin: the same sticky icon rail as the doctor workspace
 * (sections, the signed-in admin, and sign-out), so navigation stays in view
 * while the page scrolls, plus a 64px top bar holding the breadcrumb. The page
 * heading is the last breadcrumb.
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
    <div className="flex min-h-full flex-1 bg-canvas">
      <AdminRail active={active} adminName={adminName} />
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
