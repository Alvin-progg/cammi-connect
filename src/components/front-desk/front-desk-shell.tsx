import Link from "next/link";
import type { ReactNode } from "react";

import { CommandPalette } from "./command-palette";
import { FrontDeskRail } from "./front-desk-rail";
import type { FrontDeskSection } from "./nav-items";

export type { FrontDeskSection };

const SECTION_LABEL = "Front desk";

/** A breadcrumb step after "Front desk". The last one is the current page. */
export type FrontDeskCrumb = { label: string; href?: string };

/**
 * Page frame for /front-desk: the shared staff icon rail (sections, the
 * signed-in staff member, and sign-out), which stays in view while the page
 * scrolls, plus a 64px top bar holding the breadcrumb and the ⌘K search. The
 * page heading is the last breadcrumb.
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
    <div className="flex min-h-full flex-1 bg-canvas">
      <FrontDeskRail active={active} staffName={staffName} />
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
          <CommandPalette />
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
