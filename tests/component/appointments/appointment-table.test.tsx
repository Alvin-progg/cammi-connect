import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppointmentTable } from "@/components/appointments/appointment-table";
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
    id: "appointment-1",
    patientName: "Synthetic Patient A",
    reason: "Routine consultation",
    scheduledAt: "2026-10-25T01:00:00.000Z",
    durationMinutes: 30,
    status: "confirmed",
  },
  {
    id: "appointment-2",
    patientName: "Synthetic Patient B",
    reason: null,
    scheduledAt: "2026-10-25T02:30:00.000Z",
    durationMinutes: 30,
    status: "requested",
  },
];

function renderTable(appointments: DoctorAppointment[] = APPOINTMENTS) {
  return render(
    <AppointmentTable
      appointments={appointments}
      historyMap={new Map()}
      scheduleHint="Mon 09:00–17:00"
    />,
  );
}

describe("AppointmentTable", () => {
  it("renders the approved appointment fields in a semantic table", () => {
    renderTable();

    expect(screen.getByRole("table")).toBeInTheDocument();
    for (const heading of [
      "Date",
      "Time",
      "Patient",
      "Reason",
      "Status",
      "Actions",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: heading }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Synthetic Patient A")).toBeInTheDocument();
    expect(screen.getByText("Routine consultation")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("does not render a patient email or other unapproved fields", () => {
    renderTable();

    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/phone/i)).not.toBeInTheDocument();
  });

  it("uses a neutral fallback when no reason is recorded", () => {
    renderTable();

    expect(screen.getByText("No reason provided")).toBeInTheDocument();
  });

  it("shows an empty state with a safe next action", () => {
    renderTable([]);

    expect(
      screen.getByRole("heading", { name: "No appointments for this period" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reset filters" })).toHaveAttribute(
      "href",
      "/doctor",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
