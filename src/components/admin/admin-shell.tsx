import type { ReactNode } from "react";

import { StaffShell, type StaffCrumb } from "@/components/shell/staff-shell";

import { ADMIN_NAV_ITEMS, type AdminSection } from "./nav-items";

export type { AdminSection };

/** A breadcrumb step after "Admin". The last one is the current page. */
export type AdminCrumb = StaffCrumb;

/** Page frame for /admin: the grouped staff sidebar plus breadcrumb top bar. */
export function AdminShell({
  adminName,
  active,
  crumbs,
  title,
  badges,
  lead,
  actions,
  children,
}: {
  adminName: string;
  active: AdminSection;
  crumbs: [...AdminCrumb[], AdminCrumb];
  title?: ReactNode;
  badges?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <StaffShell
      navLabel="Administration"
      roleLabel="Administrator"
      homeHref="/admin"
      items={ADMIN_NAV_ITEMS}
      activeKey={active}
      personName={adminName}
      personRole="Admin"
      initialsFallback="AD"
      rootCrumb={{ label: "Admin", href: "/admin" }}
      crumbs={crumbs}
      title={title}
      badges={badges}
      lead={lead}
      actions={actions}
    >
      {children}
    </StaffShell>
  );
}
