import type { ReactNode } from "react";

import { StaffShell, type StaffCrumb } from "@/components/shell/staff-shell";

import { CommandPalette } from "./command-palette";
import { FRONT_DESK_NAV_ITEMS, type FrontDeskSection } from "./nav-items";

export type { FrontDeskSection };

/** A breadcrumb step after "Front desk". The last one is the current page. */
export type FrontDeskCrumb = StaffCrumb;

/**
 * Page frame for /front-desk: the staff sidebar with the ⌘K quick search,
 * plus the breadcrumb top bar.
 */
export function FrontDeskShell({
  staffName,
  active,
  crumbs,
  title,
  badges,
  lead,
  actions,
  requestCount,
  children,
}: {
  staffName: string;
  active: FrontDeskSection;
  crumbs: [...FrontDeskCrumb[], FrontDeskCrumb];
  title?: ReactNode;
  badges?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** Pending request count for the sidebar badge, when the page has it. */
  requestCount?: number;
  children: ReactNode;
}) {
  return (
    <StaffShell
      navLabel="Front desk"
      roleLabel="Front desk"
      homeHref="/front-desk"
      items={FRONT_DESK_NAV_ITEMS.map((item) =>
        item.key === "requests" ? { ...item, count: requestCount } : item,
      )}
      activeKey={active}
      personName={staffName}
      personRole="Front desk"
      initialsFallback="FD"
      rootCrumb={{ label: "Front desk", href: "/front-desk" }}
      crumbs={crumbs}
      title={title}
      badges={badges}
      lead={lead}
      actions={actions}
      search={<CommandPalette />}
    >
      {children}
    </StaffShell>
  );
}
