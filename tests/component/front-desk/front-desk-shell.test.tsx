import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

describe("FrontDeskShell", () => {
  function renderShell() {
    render(
      <FrontDeskShell staffName="Synthetic Front Desk">
        <p>Overview content</p>
      </FrontDeskShell>,
    );
  }

  it("marks Overview as the current page in the front desk navigation", () => {
    renderShell();

    const nav = screen.getByRole("navigation", { name: "Front desk" });
    const overview = within(nav).getByRole("link", { name: "Overview" });
    expect(overview).toHaveAttribute("href", "/front-desk");
    expect(overview).toHaveAttribute("aria-current", "page");
  });

  it("shows a breadcrumb ending at the current page", () => {
    renderShell();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByText("Front desk")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("Overview")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows the signed-in staff member, a sign-out control, and the page content", () => {
    renderShell();

    expect(screen.getByText("Synthetic Front Desk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });
});
