"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ADMIN_NAV_ITEMS } from "@/components/admin/nav-items";
import { FRONT_DESK_NAV_ITEMS } from "@/components/front-desk/nav-items";
import { Skeleton } from "@/components/ui/skeleton";

import { StaffSidebar } from "./staff-shell";

const WORKSPACES = {
  admin: {
    items: ADMIN_NAV_ITEMS,
    navLabel: "Administration",
    roleLabel: "Administrator",
    personRole: "Admin",
    homeHref: "/admin",
  },
  "front-desk": {
    items: FRONT_DESK_NAV_ITEMS,
    navLabel: "Front desk",
    roleLabel: "Front desk",
    personRole: "Front desk",
    homeHref: "/front-desk",
  },
} as const;

/** The nav item whose href is the longest prefix of the path (home matches exactly). */
function activeKeyFor(items: readonly { key: string; href: string }[], homeHref: string, pathname: string) {
  const matches = items.filter((item) =>
    item.href === homeHref ? pathname === homeHref : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.key ?? "";
}

/**
 * The staff shell while a page loads: the real sidebar stays (with the section
 * the user is heading to marked), and the top bar, title, and body are
 * placeholders. `children` is the page-shaped skeleton body.
 */
export function StaffShellLoading({
  workspace,
  children,
}: {
  workspace: keyof typeof WORKSPACES;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const config = WORKSPACES[workspace];

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas lg:flex-row">
      <StaffSidebar
        navLabel={config.navLabel}
        roleLabel={config.roleLabel}
        homeHref={config.homeHref}
        items={config.items}
        activeKey={activeKeyFor(config.items, config.homeHref, pathname)}
        personRole={config.personRole}
        initialsFallback=""
        search={workspace === "front-desk" ? <Skeleton className="h-9 w-full" /> : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          aria-hidden="true"
          className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-8"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
        <main id="main" aria-busy="true" className="flex flex-col gap-6 px-4 pb-12 pt-6 sm:px-8">
          <p role="status" className="sr-only">
            Loading…
          </p>
          <div aria-hidden="true" className="flex flex-col gap-2">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
