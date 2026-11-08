import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OverviewCards,
  PendingRequestsList,
  RecentActivityFeed,
  TodayScheduleList,
} from "@/components/front-desk/overview-sections";
import type { RecentAppointment } from "@/lib/front-desk/overview";
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

// 2026-11-04 10:00 AM in Manila: the pending request has waited 1 d 1 h.
const NOW = new Date("2026-11-04T02:00:00.000Z");

describe("OverviewCards", () => {
  it("shows the four reference cards with their context lines", () => {
    render(
      <OverviewCards
        pending={7}
        overduePending={1}
        today={{ total: 14, confirmed: 9, pending: 5, checkedIn: 3, completed: 1, noShow: 1, nextCheckIn: "2026-11-04T02:00:00.000Z" }}
      />,
    );

    const cards = within(screen.getByRole("list", { name: "Summary" })).getAllByRole("listitem");
    expect(cards.map((card) => card.querySelector("p")?.textContent)).toEqual([
      "Pending confirmation",
      "Today's appointments",
      "Checked in",
      "Completed today",
    ]);
    expect(within(cards[0]).getByText("7")).toBeInTheDocument();
    expect(within(cards[0]).getByText("1 waiting over 24 h")).toBeInTheDocument();
    expect(within(cards[1]).getByText("9 confirmed · 5 pending")).toBeInTheDocument();
    expect(within(cards[2]).getByText("Next: 10:00 AM")).toBeInTheDocument();
    expect(within(cards[3]).getByText("1 no-show")).toBeInTheDocument();
  });
});

describe("PendingRequestsList", () => {
  it("lists each pending request with its wait and a Review link", () => {
    render(<PendingRequestsList items={[PENDING]} now={NOW} />);

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Synthetic Patient A")).toBeInTheDocument();
    expect(within(item).getByText(/Dr\. Synthetic Reyes/)).toBeInTheDocument();
    expect(within(item).getByText(/9:30 AM/)).toBeInTheDocument();
    expect(within(item).getByText("Waiting 25 h")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: /Review request AB12CD34/ })).toHaveAttribute(
      "href",
      `/front-desk/requests/${PENDING.id}`,
    );
  });

  it("says when nothing is pending", () => {
    render(<PendingRequestsList items={[]} now={NOW} />);
    expect(screen.getByText("No requests are waiting for review.")).toBeInTheDocument();
  });
});

describe("TodayScheduleList", () => {
  it("lists today's appointments with time and status", () => {
    render(<TodayScheduleList items={[TODAY]} />);

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("10:00 AM")).toBeInTheDocument();
    expect(within(item).getByText("Synthetic Patient B")).toBeInTheDocument();
    expect(within(item).getByText("Checked in")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: /Synthetic Patient B/ })).toHaveAttribute(
      "href",
      `/front-desk/requests/${TODAY.id}`,
    );
  });

  it("says when there are no appointments today", () => {
    render(<TodayScheduleList items={[]} />);
    expect(screen.getByText("No appointments are scheduled today.")).toBeInTheDocument();
  });
});

describe("RecentActivityFeed", () => {
  it("describes a cancellation with its reason and links the appointment", () => {
    render(<RecentActivityFeed items={[CANCELLED]} />);

    const item = within(screen.getByRole("list", { name: "Recent activity" })).getByRole("listitem");
    expect(within(item).getByText("Synthetic Patient C")).toBeInTheDocument();
    expect(item).toHaveTextContent("cancelled");
    expect(item).toHaveTextContent("Reason: Patient request");
    expect(within(item).getByRole("link", { name: /Synthetic Patient C/ })).toHaveAttribute(
      "href",
      `/front-desk/requests/${CANCELLED.id}`,
    );
  });

  it("shows an empty message", () => {
    render(<RecentActivityFeed items={[]} />);
    expect(screen.getByText("No recent confirmations, rejections, or cancellations.")).toBeInTheDocument();
  });
});
