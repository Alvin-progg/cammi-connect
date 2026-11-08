"use client";

import { CalendarIcon, ChartIcon, ClipboardIcon, StethoscopeIcon, type IconProps } from "@/components/doctor/icons";
import { WorkspaceRail } from "@/components/ui/workspace-rail";

import {
  BookIcon,
  BuildingIcon,
  ChecklistIcon,
  DashboardIcon,
  GearIcon,
  HeartPulseIcon,
  HistoryIcon,
  TagIcon,
  UsersIcon,
} from "./icons";
import { ADMIN_NAV_ITEMS, type AdminSection } from "./nav-items";

const SECTION_ICONS: Record<AdminSection, (props: IconProps) => React.ReactNode> = {
  dashboard: DashboardIcon,
  appointments: ClipboardIcon,
  analytics: ChartIcon,
  users: UsersIcon,
  departments: BuildingIcon,
  specialties: TagIcon,
  doctors: StethoscopeIcon,
  schedules: CalendarIcon,
  services: HeartPulseIcon,
  requirements: ChecklistIcon,
  "knowledge-base": BookIcon,
  settings: GearIcon,
  "audit-log": HistoryIcon,
};

const RAIL_ITEMS = ADMIN_NAV_ITEMS.map((item) => ({ ...item, icon: SECTION_ICONS[item.key] }));

/** The admin sections in the shared staff icon rail. */
export function AdminRail({ active, adminName }: { active: AdminSection; adminName: string }) {
  return (
    <WorkspaceRail
      navId="admin-rail-nav"
      navLabel="Administration"
      homeHref="/admin"
      items={RAIL_ITEMS}
      activeKey={active}
      personName={adminName}
      personRole="Administrator"
      initialsFallback="AD"
    />
  );
}
