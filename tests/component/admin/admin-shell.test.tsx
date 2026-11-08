import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/components/admin/admin-shell";

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

// Redesign: grouped sidebar (Overview · Operations · Directory · Chatbot · System).
const EXPECTED_SECTIONS = [
  ["Dashboard", "/admin"],
  ["Analytics", "/admin/analytics"],
  ["Appointments", "/admin/appointments"],
  ["Schedules", "/admin/schedules"],
  ["Doctors", "/admin/doctors"],
  ["Departments", "/admin/departments"],
  ["Specialties", "/admin/specialties"],
  ["Services", "/admin/services"],
  ["Requirements", "/admin/requirements"],
  ["Knowledge base", "/admin/knowledge-base"],
  ["Users", "/admin/users"],
  ["Settings", "/admin/settings"],
  ["Audit log", "/admin/audit-log"],
] as const;

const EXPECTED_GROUPS = ["Overview", "Operations", "Directory", "Chatbot", "System"];

describe("AdminShell", () => {
  it("links every admin section in order and marks the active one", () => {
    render(
      <AdminShell
        adminName="Synthetic Admin"
        active="specialties"
        crumbs={[{ label: "Specialties" }]}
      >
        <p>Content</p>
      </AdminShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Administration" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(EXPECTED_SECTIONS.map(([, href]) => href));
    EXPECTED_SECTIONS.forEach(([label], index) => {
      expect(links[index]).toHaveAccessibleName(label);
    });
    expect(within(nav).getByRole("link", { name: "Specialties" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Departments" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText(/Synthetic Admin/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("keeps the sidebar fixed in view on large screens while the page scrolls", () => {
    render(
      <AdminShell adminName="Synthetic Admin" active="analytics" crumbs={[{ label: "Analytics" }]}>
        <p>Content</p>
      </AdminShell>,
    );

    const sidebar = screen.getByRole("navigation", { name: "Administration" }).closest("aside");
    expect(sidebar).toHaveClass("lg:sticky", "lg:top-0", "lg:h-dvh");
  });

  it("shows the section groups, the admin's name, and role", () => {
    render(
      <AdminShell adminName="Synthetic Admin" active="analytics" crumbs={[{ label: "Analytics" }]}>
        <p>Content</p>
      </AdminShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Administration" });
    EXPECTED_GROUPS.forEach((group) => {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    });
    expect(within(nav).getByRole("link", { name: "Analytics" })).toHaveTextContent(/^Analytics$/);
    expect(screen.getByText("Synthetic Admin")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Admin", { selector: "p" })).toBeInTheDocument();
  });

  it("shows the breadcrumb trail and uses its last step as the page heading", () => {
    render(
      <AdminShell
        adminName="Synthetic Admin"
        active="schedules"
        crumbs={[
          { label: "Schedules", href: "/admin/schedules" },
          { label: "Dr. Synthetic" },
        ]}
      >
        <p>Content</p>
      </AdminShell>,
    );

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    expect(within(breadcrumb).getByRole("link", { name: "Schedules" })).toHaveAttribute(
      "href",
      "/admin/schedules",
    );
    expect(within(breadcrumb).getByText("Dr. Synthetic")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Dr. Synthetic" })).toBeInTheDocument();
  });
});
