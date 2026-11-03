import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OverviewCards } from "@/components/front-desk/overview-cards";

describe("OverviewCards", () => {
  it("shows the four summary counts with pending first", () => {
    render(
      <OverviewCards
        counts={{ pending: 7, confirmedToday: 4, completedToday: 2, cancelledToday: 1 }}
      />,
    );

    const cards = screen.getAllByRole("listitem");
    expect(cards.map((card) => card.textContent)).toEqual([
      expect.stringContaining("Pending requests7"),
      expect.stringContaining("Confirmed today4"),
      expect.stringContaining("Completed today2"),
      expect.stringContaining("Cancelled today1"),
    ]);
  });

  it("links the pending card to the request queue", () => {
    render(
      <OverviewCards
        counts={{ pending: 7, confirmedToday: 0, completedToday: 0, cancelledToday: 0 }}
      />,
    );

    const pending = screen.getAllByRole("listitem")[0];
    expect(within(pending).getByRole("link", { name: /review pending/i })).toHaveAttribute(
      "href",
      "/front-desk/requests",
    );
  });
});
