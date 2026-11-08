"use client";

import { DashboardIcon } from "@/components/admin/icons";
import { CalendarIcon, PlusIcon, BaseIcon, type IconProps } from "@/components/doctor/icons";
import { WorkspaceRail } from "@/components/ui/workspace-rail";

import { FRONT_DESK_NAV_ITEMS, type FrontDeskSection } from "./nav-items";

function InboxIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M3 13l2.5-8h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
    </BaseIcon>
  );
}

const SECTION_ICONS: Record<FrontDeskSection, (props: IconProps) => React.ReactNode> = {
  overview: DashboardIcon,
  requests: InboxIcon,
  schedule: CalendarIcon,
  book: PlusIcon,
};

const RAIL_ITEMS = FRONT_DESK_NAV_ITEMS.map((item) => ({ ...item, icon: SECTION_ICONS[item.key] }));

/** The front desk sections in the shared staff icon rail. */
export function FrontDeskRail({ active, staffName }: { active: FrontDeskSection; staffName: string }) {
  return (
    <WorkspaceRail
      navId="front-desk-rail-nav"
      navLabel="Front desk"
      homeHref="/front-desk"
      items={RAIL_ITEMS}
      activeKey={active}
      personName={staffName}
      personRole="Front desk"
      initialsFallback="FD"
    />
  );
}
