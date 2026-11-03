import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AppointmentSearchResults,
  PendingRequestsList,
  RecentActivityList,
  TodayScheduleList,
} from "@/components/front-desk/overview-sections";
import type { AppointmentSearchItem, RecentAppointment } from "@/lib/front-desk/overview";
import type { RequestQueueItem } from "@/lib/front-desk/requests";
import type { ScheduleItem } from "@/lib/front-desk/schedule";

const PENDING: RequestQueueItem = {
  id: "ab12cd34-0000-4000-8000-000000000202",
  patientName: "Synthetic Patient A",
  patientEmail: null,
  patientPhone: null,
  doctorName: "Dr. Synthetic Reyes",
  specialtyNames: ["Cardiology"],
  // 9:30 AM on 2026-11-05 in Manila.
  scheduledAt: "2026-11-05T01:30:00.000Z",
  durationMinutes: 30,
  createdAt: "2026-11-03T01:00:00.000Z",
  status: "requested",
};

const TODAY: ScheduleItem = {
  id: "ef56ab78-0000-4000-8000-000000000211",
  patientName: "Synthetic Patient B",
  doctorName: "Dr. Synthetic Cruz",
  specialtyNames: [],
  // 10:00 AM in Manila.
  scheduledAt: "2026-11-04T02:00:00.000Z",
  durationMinutes: 30,
  status: "checked_in",
  bookingSource: "front_desk",
};

const CANCELLED: RecentAppointment = {
  id: "11aa22bb-0000-4000-8000-000000000212",
  patientName: "Synthetic Patient C",
  doctorName: "Dr. Synthetic Reyes",
  scheduledAt: "2026-11-06T01:00:00.000Z",
  status: "cancelled",
  changedAt: "2026-11-04T03:00:00.000Z",
  reason: "Patient request",
};

describe("PendingRequestsList", () => {
  it("lists each pending request with its patient, doctor, time, and details link", () => {
    render(<PendingRequestsList items={[PENDING]} total={7} />);

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Synthetic Patient A")).toBeInTheDocument();
    expect(within(item).getByText(/Dr\. Synthetic Reyes/)).toBeInTheDocument();
    expect(within(item).getByText(/9:30 AM/)).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: /AB12CD34/ })).toHaveAttribute(
      "href",
      `/front-desk/requests/${PENDING.id}`,
    );
    expect(screen.getByRole("link", { name: "View all 7 pending" })).toHaveAttribute(
      "href",
      "/front-desk/requests",
    );
  });

  it("says when nothing is pending", () => {
    render(<PendingRequestsList items={[]} total={0} />);
    expect(screen.getByText("No requests are waiting for review.")).toBeInTheDocument();
  });
});

describe("TodayScheduleList", () => {
  it("lists today's appointments with time and status and links the full schedule", () => {
    render(<TodayScheduleList items={[TODAY]} total={12} />);

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("10:00 AM")).toBeInTheDocument();
    expect(within(item).getByText("Synthetic Patient B")).toBeInTheDocument();
    expect(within(item).getByText("Checked in")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all 12 today" })).toHaveAttribute(
      "href",
      "/front-desk/schedule",
    );
  });

  it("says when there are no appointments today", () => {
    render(<TodayScheduleList items={[]} total={0} />);
    expect(screen.getByText("No appointments are scheduled today.")).toBeInTheDocument();
  });
});

describe("RecentActivityList", () => {
  it("shows the status and the reason of a cancelled appointment", () => {
    render(
      <RecentActivityList
        label="Recently rejected or cancelled"
        items={[CANCELLED]}
        emptyMessage="Nothing rejected or cancelled yet."
      />,
    );

    const list = screen.getByRole("list", { name: "Recently rejected or cancelled" });
    const item = within(list).getByRole("listitem");
    expect(within(item).getByText("Synthetic Patient C")).toBeInTheDocument();
    expect(within(item).getByText("Cancelled")).toBeInTheDocument();
    expect(within(item).getByText("Reason: Patient request")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: /11AA22BB/ })).toHaveAttribute(
      "href",
      `/front-desk/requests/${CANCELLED.id}`,
    );
  });

  it("shows the empty message", () => {
    render(
      <RecentActivityList
        label="Recently confirmed"
        items={[]}
        emptyMessage="Nothing confirmed yet."
      />,
    );
    expect(screen.getByText("Nothing confirmed yet.")).toBeInTheDocument();
  });
});

describe("AppointmentSearchResults", () => {
  const RESULT: AppointmentSearchItem = {
    id: "ab12cd34-0000-4000-8000-000000000202",
    patientName: "Synthetic Patient A",
    patientPhone: "09171234567",
    doctorName: "Dr. Synthetic Reyes",
    scheduledAt: "2026-11-05T01:30:00.000Z",
    status: "confirmed",
    bookingSource: "ai_chatbot",
  };

  it("lists matching appointments linking to their details", () => {
    render(<AppointmentSearchResults query="Synthetic" result={{ ok: true, items: [RESULT] }} />);

    const region = screen.getByRole("region", { name: "Search results for “Synthetic”" });
    expect(region).toHaveAttribute("tabindex", "0");
    const table = within(region).getByRole("table", { name: "Search results for “Synthetic”" });
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getByText("Synthetic Patient A")).toBeInTheDocument();
    expect(within(row).getByText("09171234567")).toBeInTheDocument();
    expect(within(row).getByText("Confirmed")).toBeInTheDocument();
    expect(within(row).getByText("Cami (AI assistant)")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /AB12CD34/ })).toHaveAttribute(
      "href",
      `/front-desk/requests/${RESULT.id}`,
    );
  });

  it("says when nothing matched", () => {
    render(<AppointmentSearchResults query="Nobody" result={{ ok: true, items: [] }} />);
    expect(screen.getByText("No appointments match “Nobody”.")).toBeInTheDocument();
  });

  it("shows a validation message", () => {
    render(
      <AppointmentSearchResults
        query="a"
        result={{ ok: false, message: "Enter at least 2 characters." }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Enter at least 2 characters.");
  });
});
