import type { ComponentType } from "react";

import * as Catalog from "./admin/catalog";
import * as Directory from "./admin/directory";
import * as Operations from "./admin/operations";
import * as Overview from "./admin/overview";
import * as Doctor from "./doctor/doctor";
import * as FrontDesk from "./front-desk/front-desk";
import KitScreen from "./kit/kit";
import * as Chat from "./patient/chat";
import * as Auth from "./public/auth";
import LandingScreen from "./public/landing";

export type Screen = {
  /** Hash path in this reference app. */
  path: string;
  /** The route in Alvin-progg/cammi-connect this screen redesigns. */
  route: string;
  title: string;
  group: string;
  component: ComponentType;
};

export const SCREENS: Screen[] = [
  { path: "/_kit", route: "/dev/kit (new)", title: "Component kit", group: "Kit", component: KitScreen },

  { path: "/", route: "/", title: "Landing", group: "Public and auth", component: LandingScreen },
  { path: "/login", route: "/login", title: "Sign in", group: "Public and auth", component: Auth.LoginScreen },
  { path: "/register", route: "/register", title: "Create account", group: "Public and auth", component: Auth.RegisterScreen },
  { path: "/account/password", route: "/account/password", title: "Set password", group: "Public and auth", component: Auth.SetPasswordScreen },
  { path: "/account", route: "/account", title: "Account", group: "Public and auth", component: Auth.AccountScreen },

  { path: "/chat", route: "/chat", title: "Chat · welcome", group: "Patient chat", component: Chat.ChatWelcomeScreen },
  { path: "/chat/booking", route: "/chat?c=…", title: "Chat · booking (interactive slots)", group: "Patient chat", component: Chat.ChatBookingScreen },
  { path: "/chat/answer", route: "/chat?c=…", title: "Chat · request, answer, fallback", group: "Patient chat", component: Chat.ChatAnswerScreen },
  { path: "/chat/appointments", route: "/chat?view=appointments", title: "My appointments", group: "Patient chat", component: Chat.ChatAppointmentsScreen },

  { path: "/admin", route: "/admin", title: "Dashboard", group: "Admin", component: Overview.AdminDashboardScreen },
  { path: "/admin/analytics", route: "/admin/analytics", title: "Analytics", group: "Admin", component: Overview.AdminAnalyticsScreen },
  { path: "/admin/appointments", route: "/admin/appointments", title: "Appointments", group: "Admin", component: Operations.AdminAppointmentsScreen },
  { path: "/admin/appointments/detail", route: "/admin/appointments/[id]", title: "Appointment details", group: "Admin", component: Operations.AdminAppointmentDetailScreen },
  { path: "/admin/schedules", route: "/admin/schedules", title: "Schedules", group: "Admin", component: Operations.AdminSchedulesScreen },
  { path: "/admin/schedules/exceptions", route: "/admin/schedules/exceptions", title: "Holidays and exceptions", group: "Admin", component: Operations.AdminScheduleExceptionsScreen },
  { path: "/admin/doctors", route: "/admin/doctors", title: "Doctors", group: "Admin", component: Directory.AdminDoctorsScreen },
  { path: "/admin/doctors/new", route: "/admin/doctors/new", title: "New doctor", group: "Admin", component: Directory.AdminDoctorNewScreen },
  { path: "/admin/doctors/detail", route: "/admin/doctors/[id]", title: "Doctor details", group: "Admin", component: Directory.AdminDoctorDetailScreen },
  { path: "/admin/departments", route: "/admin/departments", title: "Departments", group: "Admin", component: Directory.AdminDepartmentsScreen },
  { path: "/admin/departments/new", route: "/admin/departments/new", title: "New department", group: "Admin", component: Directory.AdminDepartmentNewScreen },
  { path: "/admin/departments/detail", route: "/admin/departments/[id]", title: "Department details", group: "Admin", component: Directory.AdminDepartmentDetailScreen },
  { path: "/admin/specialties", route: "/admin/specialties", title: "Specialties", group: "Admin", component: Directory.AdminSpecialtiesScreen },
  { path: "/admin/specialties/new", route: "/admin/specialties/new", title: "New specialty", group: "Admin", component: Directory.AdminSpecialtyNewScreen },
  { path: "/admin/specialties/detail", route: "/admin/specialties/[id]", title: "Specialty details", group: "Admin", component: Directory.AdminSpecialtyDetailScreen },
  { path: "/admin/services", route: "/admin/services", title: "Services", group: "Admin", component: Catalog.AdminServicesScreen },
  { path: "/admin/services/new", route: "/admin/services/new", title: "New service", group: "Admin", component: Catalog.AdminServiceNewScreen },
  { path: "/admin/services/detail", route: "/admin/services/[id]", title: "Service details", group: "Admin", component: Catalog.AdminServiceDetailScreen },
  { path: "/admin/requirements", route: "/admin/requirements", title: "Requirements", group: "Admin", component: Catalog.AdminRequirementsScreen },
  { path: "/admin/requirements/new", route: "/admin/requirements/new", title: "New requirement", group: "Admin", component: Catalog.AdminRequirementNewScreen },
  { path: "/admin/requirements/detail", route: "/admin/requirements/[id]", title: "Requirement details", group: "Admin", component: Catalog.AdminRequirementDetailScreen },
  { path: "/admin/knowledge-base", route: "/admin/knowledge-base", title: "Knowledge base", group: "Admin", component: Overview.AdminKnowledgeScreen },
  { path: "/admin/users", route: "/admin/users", title: "Users", group: "Admin", component: Operations.AdminUsersScreen },
  { path: "/admin/users/new", route: "/admin/users/new", title: "Invite staff", group: "Admin", component: Operations.AdminUserInviteScreen },
  { path: "/admin/users/detail", route: "/admin/users/[id]", title: "User details", group: "Admin", component: Operations.AdminUserDetailScreen },
  { path: "/admin/settings", route: "/admin/settings", title: "Settings", group: "Admin", component: Overview.AdminSettingsScreen },
  { path: "/admin/audit-log", route: "/admin/audit-log", title: "Audit log", group: "Admin", component: Overview.AdminAuditLogScreen },

  { path: "/front-desk", route: "/front-desk", title: "Overview", group: "Front desk", component: FrontDesk.FrontDeskOverviewScreen },
  { path: "/front-desk/requests", route: "/front-desk/requests", title: "Request queue", group: "Front desk", component: FrontDesk.FrontDeskRequestsScreen },
  { path: "/front-desk/requests/detail", route: "/front-desk/requests/[id]", title: "Request details", group: "Front desk", component: FrontDesk.FrontDeskRequestDetailScreen },
  { path: "/front-desk/reschedule", route: "/front-desk/requests/[id]/reschedule", title: "Reschedule", group: "Front desk", component: FrontDesk.FrontDeskRescheduleScreen },
  { path: "/front-desk/schedule", route: "/front-desk/schedule", title: "Daily schedule", group: "Front desk", component: FrontDesk.FrontDeskScheduleScreen },
  { path: "/front-desk/book", route: "/front-desk/book", title: "New appointment", group: "Front desk", component: FrontDesk.FrontDeskBookScreen },

  { path: "/doctor", route: "/doctor?view=week", title: "Week schedule", group: "Doctor", component: Doctor.DoctorWeekScreen },
  { path: "/doctor/availability", route: "/doctor?view=calendar", title: "Availability", group: "Doctor", component: Doctor.DoctorAvailabilityScreen },
  { path: "/doctor/stats", route: "/doctor?view=stats", title: "Statistics", group: "Doctor", component: Doctor.DoctorStatsScreen },
  { path: "/doctor/profile", route: "/doctor?view=profile", title: "Profile", group: "Doctor", component: Doctor.DoctorProfileScreen },
  { path: "/doctor/notifications", route: "/doctor (notifications open)", title: "Notifications", group: "Doctor", component: Doctor.DoctorNotificationsScreen },
];
