import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UsersFilters, UsersTable } from "@/components/users/users-list";
import type { AdminUserRow } from "@/lib/users/types";

const USERS: AdminUserRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000002",
    fullName: "Synthetic Desk",
    email: "desk@example.test",
    role: "front_desk",
    isActive: true,
    createdAt: "2026-10-01T02:00:00Z",
    lastSignInAt: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    fullName: "Synthetic Patient",
    email: "patient@example.test",
    role: "patient",
    isActive: false,
    createdAt: "2026-10-02T02:00:00Z",
    lastSignInAt: "2026-10-20T02:00:00Z",
  },
];

const FILTERS = { search: "synthetic", role: null, status: null, page: 2 } as const;

describe("UsersTable", () => {
  it("lists each account with role, status, and a link to its details", () => {
    render(<UsersTable users={USERS} total={30} page={2} pageCount={2} filters={FILTERS} />);

    const table = screen.getByRole("table", { name: "Accounts" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByRole("link", { name: "Synthetic Desk" })).toHaveAttribute(
      "href",
      "/admin/users/00000000-0000-4000-8000-000000000002",
    );
    expect(within(rows[1]).getByText("Front desk")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Active")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Never")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("30 accounts")).toBeInTheDocument();
  });

  it("keeps the filters in the pagination links", () => {
    render(<UsersTable users={USERS} total={30} page={2} pageCount={2} filters={FILTERS} />);

    const pagination = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(pagination).getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "href",
      "/admin/users?q=synthetic",
    );
    expect(within(pagination).queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
    expect(within(pagination).getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    render(<UsersTable users={[]} total={0} page={1} pageCount={1} filters={FILTERS} />);
    expect(screen.getByText("No accounts match these filters.")).toBeInTheDocument();
  });
});

describe("UsersFilters", () => {
  it("submits search, role, and status to the users page", () => {
    render(<UsersFilters filters={{ search: "maya", role: "doctor", status: "inactive", page: 1 }} />);

    const form = screen.getByRole("search", { name: "Filter accounts" });
    expect(form).toHaveAttribute("action", "/admin/users");
    expect(screen.getByLabelText("Search")).toHaveValue("maya");
    expect(screen.getByLabelText("Role")).toHaveValue("doctor");
    expect(screen.getByLabelText("Status")).toHaveValue("inactive");
  });
});
