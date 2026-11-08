import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestBoard, RequestQueue } from "@/components/front-desk/request-queue";
import type { RequestQueueItem } from "@/lib/front-desk/requests";

const PENDING_REQUEST: RequestQueueItem = {
  id: "ab12cd34-0000-4000-8000-000000000202",
  patientName: "Synthetic Patient B",
  patientEmail: "patient.b@example.test",
  patientPhone: null,
  doctorName: "Dr. Synthetic Reyes",
  specialtyNames: ["Cardiology", "Internal Medicine"],
  scheduledAt: "2026-11-04T02:30:00.000Z",
  durationMinutes: 30,
  createdAt: "2026-11-03T01:15:00.000Z",
  status: "requested",
};

const CANCELLED_REQUEST: RequestQueueItem = {
  ...PENDING_REQUEST,
  id: "ef56ab78-0000-4000-8000-000000000211",
  patientName: "Synthetic Patient D",
  patientEmail: null,
  patientPhone: "+63 900 000 0000",
  specialtyNames: [],
  status: "cancelled",
};

// The pending request has waited 25 hours.
const NOW = new Date("2026-11-04T02:15:00.000Z");

describe("RequestQueue", () => {
  it("lists each request with its id, patient contact, doctor, specialty, schedule, and status", () => {
    render(
      <RequestQueue items={[PENDING_REQUEST, CANCELLED_REQUEST]} limitReached={false} now={NOW} />,
    );

    const region = screen.getByRole("region", { name: "Appointment requests" });
    expect(region).toHaveAttribute("tabindex", "0");
    const table = within(region).getByRole("table", { name: "Appointment requests" });
    const rows = within(table).getAllByRole("row");
    // Header row plus two requests.
    expect(rows).toHaveLength(3);

    const pending = rows[1];
    expect(within(pending).getByText("AB12CD34")).toBeInTheDocument();
    expect(within(pending).getByText("Synthetic Patient B")).toBeInTheDocument();
    expect(within(pending).getByText("patient.b@example.test")).toBeInTheDocument();
    expect(within(pending).getByText("Phone not provided")).toBeInTheDocument();
    expect(within(pending).getByText("Dr. Synthetic Reyes")).toBeInTheDocument();
    expect(
      within(pending).getByText("Cardiology, Internal Medicine"),
    ).toBeInTheDocument();
    expect(within(pending).getByText("Nov 4, 2026")).toBeInTheDocument();
    expect(within(pending).getByText("10:30 AM")).toBeInTheDocument();
    expect(within(pending).getByText("Pending confirmation")).toBeInTheDocument();
    expect(within(pending).getByText("25 h")).toBeInTheDocument();
    expect(
      within(pending).getByRole("link", { name: "Synthetic Patient B" }),
    ).toHaveAttribute("href", "/front-desk/requests/ab12cd34-0000-4000-8000-000000000202");

    const cancelled = rows[2];
    expect(within(cancelled).getByText("Email not provided")).toBeInTheDocument();
    expect(within(cancelled).getByText("+63 900 000 0000")).toBeInTheDocument();
    expect(within(cancelled).getByText("Not specified")).toBeInTheDocument();
    expect(within(cancelled).getByText("Cancelled")).toBeInTheDocument();
  });

  it("shows an empty state when no requests match", () => {
    render(<RequestQueue items={[]} limitReached={false} />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("No requests match these filters.")).toBeInTheDocument();
  });

  it("says when only the first page of requests is shown", () => {
    render(<RequestQueue items={[PENDING_REQUEST]} limitReached />);

    expect(
      screen.getByText("Showing the first 100 requests. Narrow the filters to see more."),
    ).toBeInTheDocument();
  });

  it("states how many rows matched", () => {
    const { rerender } = render(
      <RequestQueue items={[PENDING_REQUEST]} limitReached={false} />,
    );
    expect(screen.getByText("1 request")).toBeInTheDocument();

    rerender(<RequestQueue items={[PENDING_REQUEST, CANCELLED_REQUEST]} limitReached={false} />);
    expect(screen.getByText("2 requests")).toBeInTheDocument();
  });
});

describe("RequestBoard", () => {
  it("groups requests into status columns with linked cards", () => {
    render(<RequestBoard items={[PENDING_REQUEST, CANCELLED_REQUEST]} now={NOW} />);

    const pending = screen.getByRole("region", { name: "Pending confirmation" });
    const card = within(pending).getByRole("link", { name: /Synthetic Patient B/ });
    expect(card).toHaveAttribute("href", "/front-desk/requests/ab12cd34-0000-4000-8000-000000000202");
    expect(within(card).getByText("AB12CD34")).toBeInTheDocument();
    expect(within(card).getByText("Waiting 25 h")).toBeInTheDocument();
    expect(within(pending).getByText("1")).toBeInTheDocument();

    const closed = screen.getByRole("region", { name: "Cancelled or rejected" });
    expect(within(closed).getByRole("link", { name: /Synthetic Patient D/ })).toBeInTheDocument();
    expect(within(closed).getByText("Cancelled")).toBeInTheDocument();

    expect(within(screen.getByRole("region", { name: "Confirmed" })).getByText("No requests")).toBeInTheDocument();
  });
});
