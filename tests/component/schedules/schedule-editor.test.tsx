import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ScheduleExceptionsSection,
  SchedulePeriodsSection,
} from "@/components/schedules/schedule-editor";
import type { ScheduleException, WeeklySchedule } from "@/lib/schedules/types";

vi.mock("@/server/schedules/actions", () => ({
  saveSchedulePeriodAction: vi.fn(),
  addScheduleExceptionAction: vi.fn(),
  removeScheduleExceptionAction: vi.fn(),
  adminSaveSchedulePeriodAction: vi.fn(),
  adminAddScheduleExceptionAction: vi.fn(),
  adminRemoveScheduleExceptionAction: vi.fn(),
}));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";

function period(overrides: Partial<WeeklySchedule>): WeeklySchedule {
  return {
    id: "00000000-0000-4000-8000-000000000901",
    doctorId: DOCTOR_ID,
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

const SCHEDULES = [
  period({}),
  period({
    id: "00000000-0000-4000-8000-000000000902",
    startTime: "13:00",
    endTime: "17:00",
    slotDurationMinutes: 60,
  }),
  period({
    id: "00000000-0000-4000-8000-000000000903",
    dayOfWeek: 3,
    startTime: "09:00",
    endTime: "11:00",
    effectiveUntil: "2026-12-31",
  }),
];

const LEAVE: ScheduleException = {
  id: "00000000-0000-4000-8000-000000000951",
  startsAt: "2026-11-02T00:00:00+08:00",
  endsAt: "2026-11-03T00:00:00+08:00",
  exceptionType: "leave",
  reason: "Annual leave",
};

describe("SchedulePeriodsSection", () => {
  it("lists several consultation periods under the same weekday", () => {
    render(<SchedulePeriodsSection editor="doctor" schedules={SCHEDULES} today="2026-11-01" />);

    const monday = screen.getByRole("group", { name: "Monday" });
    expect(within(monday).getAllByLabelText("Start")).toHaveLength(2);
    expect(within(monday).getAllByLabelText("Start")[1]).toHaveValue("13:00");
    expect(within(monday).getAllByLabelText("Slot length")[1]).toHaveValue("60");

    const wednesday = screen.getByRole("group", { name: "Wednesday" });
    expect(within(wednesday).getByLabelText("Effective until")).toHaveValue(
      "2026-12-31",
    );
  });

  it("offers a form to add another period, defaulting to today", () => {
    render(<SchedulePeriodsSection editor="doctor" schedules={[]} today="2026-11-01" />);

    const addForm = screen.getByRole("form", { name: "Add consultation period" });
    expect(within(addForm).getByLabelText("Weekday")).toBeInTheDocument();
    expect(within(addForm).getByLabelText("Effective from")).toHaveValue("2026-11-01");
    expect(screen.getByText("No consultation periods yet.")).toBeInTheDocument();
  });

  it("does not send a doctorId from the doctor's own editor", () => {
    const { container } = render(
      <SchedulePeriodsSection editor="doctor" schedules={SCHEDULES} today="2026-11-01" />,
    );

    expect(container.querySelector('input[name="doctorId"]')).toBeNull();
  });

  it("names the doctor being edited in the admin editor", () => {
    const { container } = render(
      <SchedulePeriodsSection
        editor="admin"
        doctorId={DOCTOR_ID}
        schedules={SCHEDULES}
        today="2026-11-01"
      />,
    );

    const doctorFields = container.querySelectorAll('input[name="doctorId"]');
    expect(doctorFields.length).toBeGreaterThan(0);
    doctorFields.forEach((field) => expect(field).toHaveValue(DOCTOR_ID));
  });
});

describe("ScheduleExceptionsSection", () => {
  it("shows exception types and lists existing exceptions with their type", () => {
    render(<ScheduleExceptionsSection editor="doctor" exceptions={[LEAVE]} />);

    const typeSelect = screen.getByLabelText("Type");
    expect(
      within(typeSelect).getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Leave", "Blocked period", "Unavailable date", "Temporary change"]);
    expect(screen.getByText("Annual leave")).toBeInTheDocument();
    expect(screen.getByText("Leave", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<ScheduleExceptionsSection editor="doctor" exceptions={[]} />);

    expect(screen.getByText("No exceptions in this period.")).toBeInTheDocument();
  });
});
