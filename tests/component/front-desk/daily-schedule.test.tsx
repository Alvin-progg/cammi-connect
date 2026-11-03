import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DailySchedule } from "@/components/front-desk/daily-schedule";
import type { ScheduleItem } from "@/lib/front-desk/schedule";

vi.mock("@/server/front-desk/actions", () => ({ recordAttendanceAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

// 10:00 on 2026-11-04 in Manila.
const NOW = new Date("2026-11-04T02:00:00.000Z");

const CONFIRMED: ScheduleItem = {
  id: "ab12cd34-0000-4000-8000-000000000202",
  patientName: "Synthetic Patient B",
  doctorName: "Dr. Synthetic Reyes",
  specialtyNames: ["Cardiology", "Internal Medicine"],
  scheduledAt: "2026-11-04T01:30:00.000Z",
  durationMinutes: 30,
  status: "confirmed",
  bookingSource: "ai_chatbot",
};

const CHECKED_IN: ScheduleItem = {
  ...CONFIRMED,
  id: "ef56ab78-0000-4000-8000-000000000211",
  patientName: "Synthetic Patient D",
  specialtyNames: [],
  scheduledAt: "2026-11-04T02:30:00.000Z",
  status: "checked_in",
  bookingSource: "front_desk",
};

const PENDING: ScheduleItem = {
  ...CONFIRMED,
  id: "11aa22bb-0000-4000-8000-000000000212",
  patientName: "Synthetic Patient E",
  status: "requested",
  bookingSource: "other",
};

describe("DailySchedule", () => {
  it("lists each appointment with time, patient, doctor, specialty, status, and source", () => {
    render(
      <DailySchedule items={[CONFIRMED, CHECKED_IN, PENDING]} limitReached={false} now={NOW} />,
    );

    const table = screen.getByRole("table", { name: "Daily schedule" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);

    const confirmed = rows[1];
    expect(within(confirmed).getByText("9:30 AM")).toBeInTheDocument();
    expect(within(confirmed).getByText("30 minutes")).toBeInTheDocument();
    expect(within(confirmed).getByText("Synthetic Patient B")).toBeInTheDocument();
    expect(within(confirmed).getByText("Dr. Synthetic Reyes")).toBeInTheDocument();
    expect(within(confirmed).getByText("Cardiology, Internal Medicine")).toBeInTheDocument();
    expect(within(confirmed).getByText("Confirmed")).toBeInTheDocument();
    expect(within(confirmed).getByText("Cami (AI assistant)")).toBeInTheDocument();
    expect(
      within(confirmed).getByRole("link", { name: "View appointment AB12CD34" }),
    ).toHaveAttribute("href", "/front-desk/requests/ab12cd34-0000-4000-8000-000000000202");

    expect(within(rows[2]).getByText("Front desk")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Not specified")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Other")).toBeInTheDocument();
  });

  it("offers only the attendance actions each status allows", () => {
    render(
      <DailySchedule items={[CONFIRMED, CHECKED_IN, PENDING]} limitReached={false} now={NOW} />,
    );
    const rows = within(screen.getByRole("table", { name: "Daily schedule" })).getAllByRole(
      "row",
    );

    expect(within(rows[1]).getByRole("button", { name: "Check in" })).toBeInTheDocument();
    expect(within(rows[1]).getByRole("button", { name: "Mark completed" })).toBeInTheDocument();
    expect(within(rows[1]).getByRole("button", { name: "Mark no-show" })).toBeInTheDocument();

    expect(within(rows[2]).queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(within(rows[2]).getByRole("button", { name: "Mark completed" })).toBeInTheDocument();

    expect(within(rows[3]).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers no attendance actions for a future day", () => {
    render(
      <DailySchedule
        items={[{ ...CONFIRMED, scheduledAt: "2026-11-05T01:30:00.000Z" }]}
        limitReached={false}
        now={NOW}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains an empty day", () => {
    render(<DailySchedule items={[]} limitReached={false} now={NOW} />);

    expect(screen.getByText("No appointments match these filters.")).toBeInTheDocument();
  });

  it("says when the list was cut off", () => {
    render(<DailySchedule items={[CONFIRMED]} limitReached now={NOW} />);

    expect(
      screen.getByText("Showing the first 200 appointments. Narrow the filters to see more."),
    ).toBeInTheDocument();
  });
});
