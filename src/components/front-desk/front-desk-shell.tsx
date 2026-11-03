import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";

/** The page every front desk view sits under; later views add nav items here. */
const SECTION_LABEL = "Front desk";
const CURRENT_PAGE = { href: "/front-desk", label: "Overview" } as const;

/**
 * Page frame for /front-desk, following the administrator shell in design.md
 * §6.7: a 240px sidebar and a 64px top bar holding the breadcrumb, the
 * signed-in staff member, and sign-out. Below `lg` the sidebar stacks above
 * the content as a top section, so navigation is never hidden behind a
 * control.
 */
export function FrontDeskShell({
  staffName,
  children,
}: {
  staffName: string;
  children: ReactNode;
}) {
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
            <li>
              <Link
                href={CURRENT_PAGE.href}
                aria-current="page"
                className="focus-ring flex min-h-11 items-center rounded-lg bg-primary-soft px-3 text-sm font-medium text-primary"
              >
                {CURRENT_PAGE.label}
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm">
              <li className="text-ink-secondary">{SECTION_LABEL}</li>
              <li aria-hidden="true" className="text-ink-muted">
                /
              </li>
              <li aria-current="page" className="font-medium text-ink">
                {CURRENT_PAGE.label}
              </li>
            </ol>
          </nav>
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm text-ink-secondary">{staffName}</span>
            <SignOutButton />
          </div>
        </header>
        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {CURRENT_PAGE.label}
            </h1>
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
