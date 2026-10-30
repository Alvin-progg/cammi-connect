import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminShell } from "@/components/admin/admin-shell";

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

describe("AdminShell", () => {
  it("links every admin view and marks the active one", () => {
    render(
      <AdminShell activeView="specialties" adminName="Synthetic Admin">
        <p>Content</p>
      </AdminShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Doctors" })).toHaveAttribute(
      "href",
      "/admin?view=doctors",
    );
    expect(screen.getByRole("link", { name: "Specialties" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Departments" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("heading", { name: "Specialties" })).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
