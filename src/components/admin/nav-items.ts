import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  ScrollText,
  Settings,
  Stethoscope,
  Tags,
  Users,
} from "lucide-react";

/**
 * Every administrator section, in sidebar order and grouped as the sidebar
 * shows them (spec-admin ADM-00; redesign: grouped 240px sidebar).
 */
export const ADMIN_NAV_ITEMS = [
  { key: "dashboard", href: "/admin", label: "Dashboard", group: "Overview", icon: LayoutDashboard },
  { key: "analytics", href: "/admin/analytics", label: "Analytics", group: "Overview", icon: BarChart3 },
  { key: "appointments", href: "/admin/appointments", label: "Appointments", group: "Operations", icon: CalendarDays },
  { key: "schedules", href: "/admin/schedules", label: "Schedules", group: "Operations", icon: CalendarClock },
  { key: "doctors", href: "/admin/doctors", label: "Doctors", group: "Directory", icon: Stethoscope },
  { key: "departments", href: "/admin/departments", label: "Departments", group: "Directory", icon: Building2 },
  { key: "specialties", href: "/admin/specialties", label: "Specialties", group: "Directory", icon: Tags },
  { key: "services", href: "/admin/services", label: "Services", group: "Directory", icon: ClipboardList },
  { key: "requirements", href: "/admin/requirements", label: "Requirements", group: "Directory", icon: FileCheck2 },
  { key: "knowledge-base", href: "/admin/knowledge-base", label: "Knowledge base", group: "Chatbot", icon: BookOpen },
  { key: "users", href: "/admin/users", label: "Users", group: "System", icon: Users },
  { key: "settings", href: "/admin/settings", label: "Settings", group: "System", icon: Settings },
  { key: "audit-log", href: "/admin/audit-log", label: "Audit log", group: "System", icon: ScrollText },
] as const;

export type AdminSection = (typeof ADMIN_NAV_ITEMS)[number]["key"];
