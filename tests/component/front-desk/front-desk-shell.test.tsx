import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FrontDeskShell } from "@/components/front-desk/front-desk-shell";

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

describe("FrontDeskShell", () => {
  function renderOverview() {
    render(
      <FrontDeskShell
        staffName="Synthetic Front Desk"
        active="overview"
        crumbs={[{ label: "Overview" }]}
      >
        <p>Overview content</p>
      </FrontDeskShell>,
    );
  }

  it("links every front desk view and marks the active one", () => {
    renderOverview();

    const nav = screen.getByRole("navigation", { name: "Front desk" });
    const overview = within(nav).getByRole("link", { name: "Overview" });
    const requests = within(nav).getByRole("link", { name: "Requests" });
    expect(overview).toHaveAttribute("href", "/front-desk");
    expect(overview).toHaveAttribute("aria-current", "page");
    expect(requests).toHaveAttribute("href", "/front-desk/requests");
    expect(requests).not.toHaveAttribute("aria-current");
    const schedule = within(nav).getByRole("link", { name: "Daily schedule" });
    expect(schedule).toHaveAttribute("href", "/front-desk/schedule");
    expect(schedule).not.toHaveAttribute("aria-current");
  });

  it("marks Daily schedule as current on the schedule page", () => {
    render(
      <FrontDeskShell
        staffName="Synthetic Front Desk"
        active="schedule"
        crumbs={[{ label: "Daily schedule" }]}
      >
        <p>Schedule</p>
      </FrontDeskShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Front desk" });
    expect(within(nav).getByRole("link", { name: "Daily schedule" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Requests as current on request pages", () => {
    render(
      <FrontDeskShell
        staffName="Synthetic Front Desk"
        active="requests"
        crumbs={[{ label: "Requests" }]}
      >
        <p>Queue</p>
      </FrontDeskShell>,
    );

    const nav = screen.getByRole("navigation", { name: "Front desk" });
    expect(within(nav).getByRole("link", { name: "Requests" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows a breadcrumb ending at the current page", () => {
    render(
      <FrontDeskShell
        staffName="Synthetic Front Desk"
        active="requests"
        crumbs={[
          { label: "Requests", href: "/front-desk/requests" },
          { label: "Request AB12CD34" },
        ]}
      >
        <p>Details</p>
      </FrontDeskShell>,
    );

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByText("Front desk")).toBeInTheDocument();
    expect(within(breadcrumb).getByRole("link", { name: "Requests" })).toHaveAttribute(
      "href",
      "/front-desk/requests",
    );
    expect(within(breadcrumb).getByText("Request AB12CD34")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Request AB12CD34" }),
    ).toBeInTheDocument();
  });

  it("shows the signed-in staff member, a sign-out control, and the page content", () => {
    renderOverview();

    expect(screen.getByText("Synthetic Front Desk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Overview content")).toBeInTheDocument();
  });
});
