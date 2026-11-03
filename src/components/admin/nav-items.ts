/**
 * Every administrator section, in sidebar order (spec-admin ADM-00). Sections
 * that later slices build show a placeholder page until then.
 */
export const ADMIN_NAV_ITEMS = [
  { key: "dashboard", href: "/admin", label: "Dashboard" },
  { key: "appointments", href: "/admin/appointments", label: "Appointments" },
  { key: "analytics", href: "/admin/analytics", label: "Analytics" },
  { key: "users", href: "/admin/users", label: "Users" },
  { key: "departments", href: "/admin/departments", label: "Departments" },
  { key: "specialties", href: "/admin/specialties", label: "Specialties" },
  { key: "doctors", href: "/admin/doctors", label: "Doctors" },
  { key: "schedules", href: "/admin/schedules", label: "Schedules" },
  { key: "services", href: "/admin/services", label: "Services" },
  { key: "requirements", href: "/admin/requirements", label: "Requirements" },
  { key: "knowledge-base", href: "/admin/knowledge-base", label: "Knowledge Base" },
  { key: "settings", href: "/admin/settings", label: "Settings" },
  { key: "audit-log", href: "/admin/audit-log", label: "Audit Log" },
] as const;

export type AdminSection = (typeof ADMIN_NAV_ITEMS)[number]["key"];
