import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    // Collapsed, each label is an sr-only name plus an aria-hidden tooltip;
    // the accessible name is what assistive technology announces.
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

  it("keeps the rail fixed in view while the page scrolls", () => {
    render(
      <AdminShell adminName="Synthetic Admin" active="analytics" crumbs={[{ label: "Analytics" }]}>
        <p>Content</p>
      </AdminShell>,
    );

    const rail = screen.getByRole("navigation", { name: "Administration" }).closest("aside");
    expect(rail).toHaveClass("sticky", "top-0", "h-dvh");
  });

  it("expands the rail to show the admin's name and section labels", async () => {
    const user = userEvent.setup();
    render(
      <AdminShell adminName="Synthetic Admin" active="analytics" crumbs={[{ label: "Analytics" }]}>
        <p>Content</p>
      </AdminShell>,
    );

    await user.click(screen.getByRole("button", { name: "Expand menu" }));

    expect(screen.getByRole("button", { name: "Collapse menu" })).toHaveAttribute("aria-expanded", "true");
    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: "Analytics" })).toHaveTextContent(/^Analytics$/);
    expect(screen.getByText("Synthetic Admin")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
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
