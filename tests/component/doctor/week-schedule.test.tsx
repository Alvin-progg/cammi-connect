import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WeekSchedule } from "@/components/doctor/week-schedule";
import type { DoctorAppointment } from "@/lib/appointments/types";
import { buildWeekLayout } from "@/lib/appointments/week";

vi.mock("@/server/appointments/actions", () => ({
  confirmAppointmentAction: vi.fn(),
  completeAppointmentAction: vi.fn(),
  markNoShowAppointmentAction: vi.fn(),
  cancelAppointmentAction: vi.fn(),
  rescheduleAppointmentAction: vi.fn(),
}));

const APPOINTMENTS: DoctorAppointment[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    patientName: "Synthetic Patient A",
    reason: "Routine consultation",
    scheduledAt: "2026-10-26T01:00:00.000Z", // Mon 09:00 PHT
    durationMinutes: 30,
    status: "requested",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    patientName: "Synthetic Patient B",
    reason: null,
    scheduledAt: "2026-10-28T03:00:00.000Z", // Wed 11:00 PHT
    durationMinutes: 45,
    status: "confirmed",
  },
];

function renderWeek(appointments = APPOINTMENTS) {
  const layout = buildWeekLayout({
    weekStart: "2026-10-25",
    appointments,
    now: new Date("2026-10-27T03:48:00.000Z"),
  });
  return render(
    <WeekSchedule
      layout={layout}
      historyById={{}}
      scheduleHint="Mon 09:00–17:00"
    />,
  );
}

describe("WeekSchedule", () => {
  it("renders a column for each day of the week", () => {
    renderWeek();
    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("group")).toHaveLength(7);
  });

  it("places each appointment in its Manila day", () => {
    renderWeek();
    const monday = screen.getByRole("group", { name: /Monday, October 26/ });
    const wednesday = screen.getByRole("group", {
      name: /Wednesday, October 28/,
    });
    expect(
      within(monday).getByRole("button", { name: /Synthetic Patient A/ }),
    ).toBeInTheDocument();
    expect(
      within(wednesday).getByRole("button", { name: /Synthetic Patient B/ }),
    ).toBeInTheDocument();
  });

  it("opens a detail popover with reason, status and actions, and closes on Escape", async () => {
    const user = userEvent.setup();
    renderWeek();

    const slot = screen.getByRole("button", { name: /Synthetic Patient A/ });
    await user.click(slot);

    const popover = screen.getByRole("dialog", { name: "Synthetic Patient A" });
    expect(slot).toHaveAttribute("aria-expanded", "true");
    expect(within(popover).getByText("Routine consultation")).toBeInTheDocument();
    expect(within(popover).getByText("Requested")).toBeInTheDocument();
    expect(within(popover).getByText("30 min")).toBeInTheDocument();
    expect(
      within(popover).getByRole("button", { name: "Confirm" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Synthetic Patient A" }),
    ).not.toBeInTheDocument();
    expect(slot).toHaveFocus();
  });

  it("shows only one popover at a time", async () => {
    const user = userEvent.setup();
    renderWeek();

    await user.click(screen.getByRole("button", { name: /Synthetic Patient A/ }));
    await user.click(screen.getByRole("button", { name: /Synthetic Patient B/ }));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByRole("dialog", { name: "Synthetic Patient B" }),
    ).toBeInTheDocument();
  });

  it("keeps the grid and notes an empty week", () => {
    renderWeek([]);
    expect(screen.getAllByRole("group")).toHaveLength(7);
    expect(screen.getByText("No appointments this week")).toBeInTheDocument();
  });
});
