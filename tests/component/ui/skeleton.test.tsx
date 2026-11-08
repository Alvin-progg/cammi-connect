import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StaffShellLoading } from "@/components/shell/staff-shell-loading";
import { ListPageSkeleton, Skeleton } from "@/components/ui/skeleton";

const pathname = vi.hoisted(() => ({ value: "/admin/doctors/123" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

describe("Skeleton", () => {
  it("is decorative and pulses only when motion is allowed", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const block = container.firstElementChild;
    expect(block).toHaveAttribute("aria-hidden", "true");
    expect(block).toHaveClass("motion-safe:animate-pulse", "h-4", "w-20");
  });
});

describe("StaffShellLoading", () => {
  it("keeps the real admin navigation, marks the section from the URL, and announces loading", () => {
    render(
      <StaffShellLoading workspace="admin">
        <ListPageSkeleton />
      </StaffShellLoading>,
    );

    const nav = screen.getByRole("navigation", { name: "Administration" });
    expect(within(nav).getByRole("link", { name: "Doctors" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("matches the front desk overview only on its exact path", () => {
    pathname.value = "/front-desk/requests/abc";
    render(
      <StaffShellLoading workspace="front-desk">
        <ListPageSkeleton />
      </StaffShellLoading>,
    );

    const nav = screen.getByRole("navigation", { name: "Front desk" });
    expect(within(nav).getByRole("link", { name: "Requests" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });
});

describe("AuthCardSkeleton", () => {
  it("announces loading once and hides the placeholder card", async () => {
    const { AuthCardSkeleton } = await import("@/components/auth/auth-card-skeleton");
    render(<AuthCardSkeleton fields={3} />);

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
