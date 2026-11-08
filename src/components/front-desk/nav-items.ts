import { CalendarDays, CalendarPlus, LayoutDashboard, ListChecks } from "lucide-react";

/** The front desk sections, shared by the sidebar and the ⌘K palette. */
export const FRONT_DESK_NAV_ITEMS = [
  { key: "overview", href: "/front-desk", label: "Overview", icon: LayoutDashboard },
  { key: "requests", href: "/front-desk/requests", label: "Requests", icon: ListChecks },
  { key: "schedule", href: "/front-desk/schedule", label: "Daily schedule", icon: CalendarDays },
  { key: "book", href: "/front-desk/book", label: "New appointment", icon: CalendarPlus },
] as const;

export type FrontDeskSection = (typeof FRONT_DESK_NAV_ITEMS)[number]["key"];
