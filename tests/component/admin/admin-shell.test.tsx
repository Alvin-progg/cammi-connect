import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/components/admin/admin-shell";

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

const EXPECTED_SECTIONS = [
  ["Dashboard", "/admin"],
  ["Appointments", "/admin/appointments"],
  ["Analytics", "/admin/analytics"],
  ["Users", "/admin/users"],
  ["Departments", "/admin/departments"],
  ["Specialties", "/admin/specialties"],
  ["Doctors", "/admin/doctors"],
  ["Schedules", "/admin/schedules"],
  ["Services", "/admin/services"],
  ["Requirements", "/admin/requirements"],
  ["Knowledge Base", "/admin/knowledge-base"],
  ["Settings", "/admin/settings"],
  ["Audit Log", "/admin/audit-log"],
] as const;

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
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(
      EXPECTED_SECTIONS.map(([label, href]) => [label, href]),
    );
    expect(within(nav).getByRole("link", { name: "Specialties" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Departments" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Synthetic Admin")).toBeInTheDocument();
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
    expect(within(breadcrumb).getByText("Administration")).toBeInTheDocument();
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
