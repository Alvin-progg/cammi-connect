import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleManager } from "@/components/doctor/schedule-manager";
import { buildMonthGrid } from "@/lib/schedules/calendar";

vi.mock("@/server/schedules/actions", () => ({
  saveSchedulePeriodAction: vi.fn(),
  addScheduleExceptionAction: vi.fn(),
  removeScheduleExceptionAction: vi.fn(),
  adminSaveSchedulePeriodAction: vi.fn(),
  adminAddScheduleExceptionAction: vi.fn(),
  adminRemoveScheduleExceptionAction: vi.fn(),
}));

const grid = buildMonthGrid({
  month: "2026-11",
  today: "2026-11-01",
  schedules: [
    { dayOfWeek: 1, isActive: true, effectiveFrom: "2026-01-01", effectiveUntil: null },
  ],
  blocksByDate: new Map([
    ["2026-11-02", { type: "leave", reason: "Annual leave", allDay: true }],
    ["2026-11-09", { type: "blocked_period", reason: "Staff meeting", allDay: false }],
  ]),
  countByDate: new Map([["2026-11-16", { confirmed: 2 }]]),
});

function renderManager() {
  render(
    <ScheduleManager
      schedules={[]}
      exceptions={[]}
      month="2026-11"
      today="2026-11-01"
      grid={grid}
    />,
  );
}

describe("ScheduleManager calendar", () => {
  it("links every day of the month to its week in the schedule view", () => {
    renderManager();

    const dayLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("view=week"));
    expect(dayLinks).toHaveLength(30);
    expect(dayLinks[0]).toHaveAttribute("href", "/doctor?view=week&week=2026-11-01");
  });

  it("names the exception on blocked days, telling whole and partial days apart", () => {
    renderManager();

    expect(screen.getByRole("link", { name: /Leave: Annual leave, all day/ })).toHaveAttribute(
      "href",
      "/doctor?view=week&week=2026-11-02",
    );
    expect(
      screen.getByRole("link", { name: /Blocked period: Staff meeting, part of the day/ }),
    ).toHaveAttribute("href", "/doctor?view=week&week=2026-11-09");
  });

  it("includes consultation days and appointment counts in the day's name", () => {
    renderManager();

    expect(
      screen.getByRole("link", { name: /consultation day, 2 appointments/ }),
    ).toHaveAttribute("href", "/doctor?view=week&week=2026-11-16");
  });

  it("offers month navigation including a jump back to today", () => {
    renderManager();

    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute(
      "href",
      "/doctor?view=calendar",
    );
    expect(screen.getByRole("link", { name: "Previous month" })).toHaveAttribute(
      "href",
      "/doctor?view=calendar&month=2026-10",
    );
    expect(screen.getByRole("link", { name: "Next month" })).toHaveAttribute(
      "href",
      "/doctor?view=calendar&month=2026-12",
    );
  });

  it("shows the calendar before the editors", () => {
    renderManager();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["November 2026", "Weekly hours", "Time off & exceptions"]);
  });
});
