import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeeklyPeriodGrid } from "@/components/schedules/weekly-period-grid";
import type { WeeklySchedule } from "@/lib/schedules/types";

function period(overrides: Partial<WeeklySchedule>): WeeklySchedule {
  return {
    id: "00000000-0000-4000-8000-000000000901",
    doctorId: "00000000-0000-4000-8000-000000000101",
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "12:00",
    slotDurationMinutes: 30,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    isActive: true,
    ...overrides,
  };
}

describe("WeeklyPeriodGrid", () => {
  it("shows Monday-to-Sunday columns with each period as a block", () => {
    render(
      <WeeklyPeriodGrid
        today="2026-11-04"
        schedules={[
          period({}),
          period({ id: "afternoon", startTime: "13:00", endTime: "17:00" }),
        ]}
      />,
    );

    const columns = screen
      .getAllByRole("listitem")
      .filter((item) => item.hasAttribute("aria-label"));
    expect(columns.map((column) => column.getAttribute("aria-label"))).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    const monday = screen.getByRole("listitem", { name: "Monday" });
    expect(within(monday).getByText("8:00 AM – 12:00 PM")).toBeInTheDocument();
    expect(within(monday).getByText("1:00 PM – 5:00 PM")).toBeInTheDocument();
    expect(within(monday).getAllByText("30-min slots")).toHaveLength(2);
    expect(
      within(screen.getByRole("listitem", { name: "Tuesday" })).getByText("Not available"),
    ).toBeInTheDocument();
  });

  it("marks inactive, upcoming, and ended periods", () => {
    render(
      <WeeklyPeriodGrid
        today="2026-11-04"
        schedules={[
          period({ id: "inactive", isActive: false }),
          period({ id: "upcoming", dayOfWeek: 2, effectiveFrom: "2026-12-01" }),
          period({ id: "ended", dayOfWeek: 3, effectiveUntil: "2026-10-31" }),
        ]}
      />,
    );

    expect(within(screen.getByRole("listitem", { name: "Monday" })).getByText("Inactive")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Tuesday" })).getByText("Starts Dec 1, 2026")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Wednesday" })).getByText("Ended Oct 31, 2026")).toBeInTheDocument();
  });

  it("shows an empty state when the doctor has no periods", () => {
    render(<WeeklyPeriodGrid today="2026-11-04" schedules={[]} />);
    expect(screen.getByText("No consultation periods yet.")).toBeInTheDocument();
  });
});
