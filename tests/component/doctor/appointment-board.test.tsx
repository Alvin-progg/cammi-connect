import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppointmentBoard } from "@/components/doctor/appointment-board";
import type { DoctorAppointment } from "@/lib/appointments/types";

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
    scheduledAt: "2026-10-26T01:00:00.000Z",
    durationMinutes: 30,
    status: "requested",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    patientName: "Synthetic Patient B",
    reason: null,
    scheduledAt: "2026-10-26T03:00:00.000Z",
    durationMinutes: 45,
    status: "confirmed",
  },
];

describe("AppointmentBoard", () => {
  it("renders all five status columns", () => {
    render(
      <AppointmentBoard
        appointments={APPOINTMENTS}
        historyMap={new Map()}
        scheduleHint="Mon 09:00–17:00"
      />,
    );

    for (const column of [
      "Pending",
      "Confirmed",
      "Completed",
      "Cancelled",
      "No-show",
    ]) {
      expect(
        screen.getByRole("heading", { name: column }),
      ).toBeInTheDocument();
    }
  });

  it("places cards in the column matching their status", () => {
    render(
      <AppointmentBoard
        appointments={APPOINTMENTS}
        historyMap={new Map()}
        scheduleHint="Mon 09:00–17:00"
      />,
    );

    const pendingColumn = screen
      .getByRole("heading", { name: "Pending" })
      .closest("section");
    const confirmedColumn = screen
      .getByRole("heading", { name: "Confirmed" })
      .closest("section");

    expect(pendingColumn).not.toBeNull();
    expect(confirmedColumn).not.toBeNull();
    expect(
      within(pendingColumn as HTMLElement).getByText("Synthetic Patient A"),
    ).toBeInTheDocument();
    expect(
      within(confirmedColumn as HTMLElement).getByText("Synthetic Patient B"),
    ).toBeInTheDocument();
  });

  it("shows the reason, duration, and manage controls on a card", () => {
    render(
      <AppointmentBoard
        appointments={APPOINTMENTS}
        historyMap={new Map()}
        scheduleHint="Mon 09:00–17:00"
      />,
    );

    expect(screen.getByText("Routine consultation")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Manage" }),
    ).toHaveLength(2);
  });

  it("offers Confirm only for pending requests", () => {
    render(
      <AppointmentBoard
        appointments={APPOINTMENTS}
        historyMap={new Map()}
        scheduleHint="Mon 09:00–17:00"
      />,
    );

    const pendingColumn = screen
      .getByRole("heading", { name: "Pending" })
      .closest("section") as HTMLElement;
    const confirmedColumn = screen
      .getByRole("heading", { name: "Confirmed" })
      .closest("section") as HTMLElement;

    expect(
      within(pendingColumn).getByRole("button", { name: "Confirm" }),
    ).toBeInTheDocument();
    expect(
      within(confirmedColumn).queryByRole("button", { name: "Confirm" }),
    ).not.toBeInTheDocument();
    expect(
      within(confirmedColumn).getByRole("button", { name: "Complete" }),
    ).toBeInTheDocument();
  });

  it("renders an empty state with a reset link when there are no appointments", () => {
    render(
      <AppointmentBoard
        appointments={[]}
        historyMap={new Map()}
        scheduleHint="Mon 09:00–17:00"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No appointments for this period" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Reset filters" }),
    ).toHaveAttribute("href", "/doctor");
  });
});
