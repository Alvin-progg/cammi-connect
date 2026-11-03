/** The front desk sections, shared by the sidebar and the ⌘K palette. */
export const FRONT_DESK_NAV_ITEMS = [
  { key: "overview", href: "/front-desk", label: "Overview" },
  { key: "requests", href: "/front-desk/requests", label: "Requests" },
  { key: "schedule", href: "/front-desk/schedule", label: "Daily schedule" },
  { key: "book", href: "/front-desk/book", label: "New appointment" },
] as const;

export type FrontDeskSection = (typeof FRONT_DESK_NAV_ITEMS)[number]["key"];
