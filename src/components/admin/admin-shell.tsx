import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  ADMIN_VIEWS,
  ADMIN_VIEW_LABELS,
  type AdminView,
} from "@/lib/admin/dashboard";

/** Page frame for /admin: brand, signed-in admin, view tabs, and content. */
export function AdminShell({
  activeView,
  adminName,
  children,
}: {
  activeView: AdminView;
  adminName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-[90rem] flex-wrap items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              className="rounded-lg text-base font-semibold tracking-tight text-ink focus-ring"
            >
              CamiConnect
            </Link>
            <span className="text-sm text-ink-secondary">Administration</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-secondary">{adminName}</span>
            <SignOutButton />
          </div>
        </div>
        <nav
          aria-label="Administration"
          className="mx-auto w-full max-w-[90rem] overflow-x-auto px-4 sm:px-6 lg:px-8"
        >
          <ul className="flex gap-1">
            {ADMIN_VIEWS.map((view) => {
              const active = view === activeView;
              return (
                <li key={view}>
                  <Link
                    href={`/admin?view=${view}`}
                    aria-current={active ? "page" : undefined}
                    className={`focus-ring inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors motion-reduce:transition-none ${
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {ADMIN_VIEW_LABELS[view]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="main" className="flex-1">
        <div className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {ADMIN_VIEW_LABELS[activeView]}
          </h1>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
