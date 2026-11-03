import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestDetailsView } from "@/components/front-desk/request-details";
import type { RequestDetails } from "@/lib/front-desk/requests";

const REQUEST: RequestDetails = {
  id: "ab12cd34-0000-4000-8000-000000000202",
  doctorId: "00000000-0000-4000-8000-000000000101",
  patientName: "Synthetic Patient B",
  patientEmail: "patient.b@example.test",
  patientPhone: null,
  doctorName: "Dr. Synthetic Reyes",
  specialtyNames: ["Cardiology"],
  scheduledAt: "2026-11-04T02:30:00.000Z",
  durationMinutes: 30,
  createdAt: "2026-11-03T01:15:00.000Z",
  status: "cancelled",
  bookingSource: "ai_chatbot",
  reason: "Follow-up check-up",
  rejectionReason: null,
  cancellationReason: "Patient asked to move to next week",
  history: [
    {
      id: "00000000-0000-4000-8000-000000000901",
      action: "created",
      previousStatus: null,
      newStatus: "requested",
      actorName: "Synthetic Patient B",
      actorRole: "patient",
      reason: null,
      scheduledAt: "2026-11-04T02:30:00.000Z",
      createdAt: "2026-11-03T01:15:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000902",
      action: "cancelled",
      previousStatus: "requested",
      newStatus: "cancelled",
      actorName: null,
      actorRole: null,
      reason: "Patient asked to move to next week",
      scheduledAt: null,
      createdAt: "2026-11-03T03:00:00.000Z",
    },
  ],
};

describe("RequestDetailsView", () => {
  it("shows the patient and how to reach them", () => {
    render(<RequestDetailsView request={REQUEST} />);

    const patient = screen.getByRole("region", { name: "Patient" });
    expect(within(patient).getByText("Synthetic Patient B")).toBeInTheDocument();
    expect(within(patient).getByText("patient.b@example.test")).toBeInTheDocument();
    expect(within(patient).getByText("Not provided")).toBeInTheDocument();
  });

  it("shows the requested appointment, its source, and its status", () => {
    render(<RequestDetailsView request={REQUEST} />);

    const appointment = screen.getByRole("region", { name: "Appointment" });
    expect(within(appointment).getByText("AB12CD34")).toBeInTheDocument();
    expect(within(appointment).getByText("Dr. Synthetic Reyes")).toBeInTheDocument();
    expect(within(appointment).getByText("Cardiology")).toBeInTheDocument();
    expect(within(appointment).getByText("Nov 4, 2026")).toBeInTheDocument();
    expect(within(appointment).getByText("10:30 AM · 30 minutes")).toBeInTheDocument();
    expect(within(appointment).getByText("Cami (AI assistant)")).toBeInTheDocument();
    expect(within(appointment).getByText("Cancelled")).toBeInTheDocument();
    expect(
      within(appointment).getByText("Patient asked to move to next week"),
    ).toBeInTheDocument();
  });

  it("shows the schedule check for a pending request", () => {
    render(
      <RequestDetailsView
        request={{ ...REQUEST, status: "requested", cancellationReason: null }}
        slotCheck="outside_hours"
      />,
    );

    const appointment = screen.getByRole("region", { name: "Appointment" });
    expect(
      within(appointment).getByText("Outside the doctor's current hours"),
    ).toBeInTheDocument();
  });

  it("omits the schedule check once the request is decided", () => {
    render(<RequestDetailsView request={REQUEST} slotCheck={null} />);

    expect(screen.queryByText("Schedule check")).not.toBeInTheDocument();
  });

  it("shows what the patient told Cami and that transcripts are not shared", () => {
    render(<RequestDetailsView request={REQUEST} />);

    const provided = screen.getByRole("region", { name: "Patient-provided information" });
    expect(within(provided).getByText("Follow-up check-up")).toBeInTheDocument();
    expect(
      within(provided).getByText(
        "Chat transcripts are not shared with front desk staff.",
      ),
    ).toBeInTheDocument();
  });

  it("falls back when the patient gave no reason", () => {
    render(<RequestDetailsView request={{ ...REQUEST, reason: null }} />);

    const provided = screen.getByRole("region", { name: "Patient-provided information" });
    expect(within(provided).getByText("No reason given.")).toBeInTheDocument();
  });

  it("lists the status history oldest first with who acted", () => {
    render(<RequestDetailsView request={REQUEST} />);

    const history = screen.getByRole("region", { name: "Status history" });
    const entries = within(history).getAllByRole("listitem");
    expect(entries).toHaveLength(2);
    expect(within(entries[0]).getByText("Request submitted")).toBeInTheDocument();
    expect(
      within(entries[0]).getByText("Synthetic Patient B (Patient)"),
    ).toBeInTheDocument();
    expect(within(entries[1]).getByText("Cancelled")).toBeInTheDocument();
    expect(within(entries[1]).getByText("System")).toBeInTheDocument();
    expect(
      within(entries[1]).getByText("Reason: Patient asked to move to next week"),
    ).toBeInTheDocument();
  });
});
