import { describe, expect, it } from "vitest";

import { mergeRecentActivity, summarizeToday, type RecentAppointment } from "@/lib/front-desk/overview";
import {
  formatWaiting,
  groupRequestBoard,
  nextPendingRequest,
  parseRequestView,
  type RequestQueueItem,
} from "@/lib/front-desk/requests";
import { shiftManilaDate, type ScheduleItem } from "@/lib/front-desk/schedule";

function scheduleItem(id: string, status: ScheduleItem["status"], scheduledAt: string): ScheduleItem {
  return {
    id,
    patientName: `Patient ${id}`,
    doctorName: "Dr. Synthetic",
    specialtyNames: [],
    scheduledAt,
    durationMinutes: 30,
    status,
    bookingSource: "ai_chatbot",
  };
}

function queueItem(id: string, status: RequestQueueItem["status"]): RequestQueueItem {
  return {
    id,
    patientName: `Patient ${id}`,
    patientEmail: null,
    patientPhone: null,
    doctorName: "Dr. Synthetic",
    specialtyNames: [],
    scheduledAt: "2026-11-09T01:30:00.000Z",
    durationMinutes: 30,
    createdAt: "2026-11-08T00:00:00.000Z",
    status,
  };
}

describe("summarizeToday", () => {
  it("counts today's appointments by status and finds the next confirmed visit", () => {
    // 9:00 AM Manila = 01:00Z.
    const now = new Date("2026-11-09T01:00:00.000Z");
    const items = [
      scheduleItem("a", "checked_in", "2026-11-09T00:30:00.000Z"),
      scheduleItem("b", "confirmed", "2026-11-09T00:45:00.000Z"),
      scheduleItem("c", "confirmed", "2026-11-09T02:00:00.000Z"),
      scheduleItem("d", "confirmed", "2026-11-09T01:30:00.000Z"),
      scheduleItem("e", "requested", "2026-11-09T03:00:00.000Z"),
      scheduleItem("f", "completed", "2026-11-09T00:00:00.000Z"),
      scheduleItem("g", "no_show", "2026-11-09T00:15:00.000Z"),
      scheduleItem("h", "cancelled", "2026-11-09T04:00:00.000Z"),
    ];

    expect(summarizeToday(items, now)).toEqual({
      total: 8,
      confirmed: 3,
      pending: 1,
      checkedIn: 1,
      completed: 1,
      noShow: 1,
      nextCheckIn: "2026-11-09T01:30:00.000Z",
    });
  });

  it("has no next visit when nothing confirmed is still ahead", () => {
    const summary = summarizeToday([], new Date("2026-11-09T01:00:00.000Z"));
    expect(summary.total).toBe(0);
    expect(summary.nextCheckIn).toBeNull();
  });
});

describe("mergeRecentActivity", () => {
  const base: Omit<RecentAppointment, "id" | "status" | "changedAt"> = {
    patientName: "Synthetic Patient",
    doctorName: "Dr. Synthetic",
    scheduledAt: "2026-11-09T01:00:00.000Z",
    reason: null,
  };

  it("merges confirmed and closed appointments newest first", () => {
    const merged = mergeRecentActivity(
      [{ ...base, id: "c1", status: "confirmed", changedAt: "2026-11-09T01:00:00.000Z" }],
      [
        { ...base, id: "r1", status: "rejected", changedAt: "2026-11-09T02:00:00.000Z", reason: "Doctor unavailable" },
        { ...base, id: "x1", status: "cancelled", changedAt: "2026-11-08T23:00:00.000Z" },
      ],
    );

    expect(merged.map((item) => item.id)).toEqual(["r1", "c1", "x1"]);
  });
});

describe("formatWaiting", () => {
  const now = new Date("2026-11-09T12:00:00.000Z");

  it.each([
    ["2026-11-09T11:20:00.000Z", "40 min", false],
    ["2026-11-09T11:59:30.000Z", "1 min", false],
    ["2026-11-08T18:00:00.000Z", "18 h", false],
    ["2026-11-08T12:00:00.000Z", "24 h", true],
    ["2026-11-06T12:00:00.000Z", "3 d", true],
  ])("formats a request created at %s as %s", (createdAt, label, overdue) => {
    expect(formatWaiting(createdAt, now)).toEqual({ label, overdue });
  });
});

describe("groupRequestBoard", () => {
  it("puts requests into the four board columns and leaves out finished visits", () => {
    const columns = groupRequestBoard([
      queueItem("p", "requested"),
      queueItem("c", "confirmed"),
      queueItem("i", "checked_in"),
      queueItem("r", "rejected"),
      queueItem("x", "cancelled"),
      queueItem("d", "completed"),
      queueItem("n", "no_show"),
    ]);

    expect(columns.map((column) => [column.title, column.items.map((item) => item.id)])).toEqual([
      ["Pending confirmation", ["p"]],
      ["Confirmed", ["c"]],
      ["Checked in", ["i"]],
      ["Cancelled or rejected", ["r", "x"]],
    ]);
  });
});

describe("parseRequestView", () => {
  it("defaults to the board and accepts list", () => {
    expect(parseRequestView({})).toBe("board");
    expect(parseRequestView({ view: "list" })).toBe("list");
    expect(parseRequestView({ view: ["list", "board"] })).toBe("list");
    expect(parseRequestView({ view: "kanban" })).toBe("board");
  });
});

describe("nextPendingRequest", () => {
  it("returns the position and the next request, wrapping to the first", () => {
    expect(nextPendingRequest(["a", "b", "c"], "a")).toEqual({ position: 1, total: 3, nextId: "b" });
    expect(nextPendingRequest(["a", "b", "c"], "c")).toEqual({ position: 3, total: 3, nextId: "a" });
  });

  it("has no next request when the current one is the only one or is not pending", () => {
    expect(nextPendingRequest(["a"], "a")).toEqual({ position: 1, total: 1, nextId: null });
    expect(nextPendingRequest(["a", "b"], "z")).toBeNull();
  });
});

describe("shiftManilaDate", () => {
  it("moves a calendar date across month and year boundaries", () => {
    expect(shiftManilaDate("2026-11-09", 1)).toBe("2026-11-10");
    expect(shiftManilaDate("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftManilaDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});
