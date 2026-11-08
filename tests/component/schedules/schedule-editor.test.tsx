import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ScheduleExceptionsSection,
  SchedulePeriodsSection,
} from "@/components/schedules/schedule-editor";
import type { ScheduleException, WeeklySchedule } from "@/lib/schedules/types";
import {
  addScheduleExceptionAction,
  adminAddHolidayAction,
  removeScheduleExceptionAction,
  saveSchedulePeriodAction,
} from "@/server/schedules/actions";

vi.mock("@/server/schedules/actions", () => ({
  saveSchedulePeriodAction: vi.fn(),
  addScheduleExceptionAction: vi.fn(),
  removeScheduleExceptionAction: vi.fn(),
  adminSaveSchedulePeriodAction: vi.fn(),
  adminAddScheduleExceptionAction: vi.fn(),
  adminRemoveScheduleExceptionAction: vi.fn(),
  adminAddHolidayAction: vi.fn(),
  adminRemoveHolidayAction: vi.fn(),
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
  doctorId: DOCTOR_ID,
  startsAt: "2026-11-02T00:00:00+08:00",
  endsAt: "2026-11-03T00:00:00+08:00",
  exceptionType: "leave",
  reason: "Annual leave",
};

const ALL_SAINTS: ScheduleException = {
  id: "00000000-0000-4000-8000-000000000952",
  doctorId: null,
  startsAt: "2026-11-01T00:00:00+08:00",
  endsAt: "2026-11-02T00:00:00+08:00",
  exceptionType: "holiday",
  reason: "All Saints' Day",
};

async function submitException(user: ReturnType<typeof userEvent.setup>, buttonName: string) {
  const form = screen.getByRole("form", { name: /^Add / });
  await user.type(within(form).getByLabelText("From date"), "2026-11-02");
  await user.type(within(form).getByLabelText("Reason"), "Annual leave");
  await user.click(within(form).getByRole("button", { name: buttonName }));
}

const DOCTOR_EDITOR = { editor: "doctor", today: "2026-11-01", defaultSlotMinutes: 30 } as const;

describe("SchedulePeriodsSection", () => {
  it("lists several consultation periods under the same weekday", () => {
    render(<SchedulePeriodsSection {...DOCTOR_EDITOR} schedules={SCHEDULES} />);

    const monday = screen.getByRole("group", { name: "Monday" });
    expect(within(monday).getAllByLabelText("Start")).toHaveLength(2);
    expect(within(monday).getAllByLabelText("Start")[1]).toHaveValue("13:00");
    expect(within(monday).getAllByLabelText("Slot length")[1]).toHaveValue("60");

    const wednesday = screen.getByRole("group", { name: "Wednesday" });
    expect(within(wednesday).getByLabelText("Effective until")).toHaveValue(
      "2026-12-31",
    );
  });

  it("summarizes each period read-only before it is edited", () => {
    render(<SchedulePeriodsSection {...DOCTOR_EDITOR} schedules={SCHEDULES} />);

    const monday = screen.getByRole("group", { name: "Monday" });
    expect(within(monday).getByText("8:00 AM – 12:00 PM · 30 min")).toBeInTheDocument();
    expect(within(monday).getByText("1:00 PM – 5:00 PM · 60 min")).toBeInTheDocument();

    const wednesday = screen.getByRole("group", { name: "Wednesday" });
    expect(within(wednesday).getByText("Until Dec 31, 2026")).toBeInTheDocument();
  });

  it("lists the upcoming appointments that block a save", async () => {
    vi.mocked(saveSchedulePeriodAction).mockResolvedValue({
      status: "error",
      message: "This change would leave 1 upcoming appointment outside the doctor's hours.",
      conflicts: [
        {
          appointmentId: "00000000-0000-4000-8000-000000000201",
          scheduledAt: "2026-11-02T01:00:00.000Z",
          status: "confirmed",
        },
      ],
    });
    const user = userEvent.setup();
    render(<SchedulePeriodsSection {...DOCTOR_EDITOR} schedules={[period({})]} />);

    await user.click(within(screen.getByRole("group", { name: "Monday" })).getByRole("button", { name: "Save period" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("outside the doctor's hours");
    const blocking = screen.getByRole("list", { name: "Blocking appointments" });
    expect(within(blocking).getByText("Confirmed")).toBeInTheDocument();
    expect(within(blocking).getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows weekdays without periods as not available", () => {
    render(<SchedulePeriodsSection {...DOCTOR_EDITOR} schedules={SCHEDULES} />);

    const tuesday = screen.getByRole("group", { name: "Tuesday" });
    expect(within(tuesday).getByText("Not available")).toBeInTheDocument();
  });

  it("flags inactive periods", () => {
    render(
      <SchedulePeriodsSection
        editor="doctor"
        schedules={[period({ isActive: false })]}
        today="2026-11-01"
        defaultSlotMinutes={30}
      />,
    );

    const monday = screen.getByRole("group", { name: "Monday" });
    expect(within(monday).getByText("Inactive")).toBeInTheDocument();
  });

  it("offers a form to add another period, defaulting to today", () => {
    render(<SchedulePeriodsSection {...DOCTOR_EDITOR} schedules={[]} />);

    const addForm = screen.getByRole("form", { name: "Add consultation period" });
    expect(within(addForm).getByLabelText("Weekday")).toBeInTheDocument();
    expect(within(addForm).getByLabelText("Effective from")).toHaveValue("2026-11-01");
    expect(screen.getByText("No consultation periods yet.")).toBeInTheDocument();
  });

  it("defaults a new period to the admin's slot length (appointment.default_slot_minutes)", () => {
    render(<SchedulePeriodsSection {...DOCTOR_EDITOR} schedules={[]} defaultSlotMinutes={45} />);

    const addForm = screen.getByRole("form", { name: "Add consultation period" });
    expect(within(addForm).getByLabelText("Slot length")).toHaveValue("45");
  });

  it("does not send a doctorId from the doctor's own editor", () => {
    const { container } = render(
      <SchedulePeriodsSection {...DOCTOR_EDITOR} schedules={SCHEDULES} />,
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
        defaultSlotMinutes={30}
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

  it("asks for confirmation before removing an exception", async () => {
    const user = userEvent.setup();
    render(<ScheduleExceptionsSection editor="doctor" exceptions={[LEAVE]} />);

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByText("Remove? This reopens these slots for booking.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(removeScheduleExceptionAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  });

  it("shows an empty state", () => {
    render(<ScheduleExceptionsSection editor="doctor" exceptions={[]} />);

    expect(screen.getByText("No exceptions in this period.")).toBeInTheDocument();
  });

  it("marks hospital holidays and leaves their removal to the holidays page", () => {
    render(<ScheduleExceptionsSection editor="doctor" exceptions={[ALL_SAINTS]} />);

    expect(screen.getByText("Hospital holiday", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("All Saints' Day")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("lists the appointments that block a new exception", async () => {
    const user = userEvent.setup();
    vi.mocked(addScheduleExceptionAction).mockResolvedValue({
      status: "error",
      message:
        "This exception covers 1 existing appointment. Ask the front desk to reschedule or cancel it first.",
      conflicts: [
        {
          appointmentId: "00000000-0000-4000-8000-000000000201",
          scheduledAt: "2026-11-02T01:00:00.000Z",
          status: "confirmed",
        },
      ],
    });
    render(<ScheduleExceptionsSection editor="doctor" exceptions={[]} />);

    await submitException(user, "Add exception");

    expect(await screen.findByRole("alert")).toHaveTextContent("This exception covers 1 existing appointment");
    const blocking = screen.getByRole("list", { name: "Blocking appointments" });
    expect(within(blocking).getByText("Confirmed")).toBeInTheDocument();
  });
});

describe("ScheduleExceptionsSection for hospital holidays", () => {
  it("lists holidays with a remove control and no type choice", () => {
    render(<ScheduleExceptionsSection editor="holiday" exceptions={[ALL_SAINTS]} />);

    expect(screen.getByRole("heading", { name: "Hospital holidays" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Type")).toBeNull();
    expect(screen.getByText("All Saints' Day")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<ScheduleExceptionsSection editor="holiday" exceptions={[]} />);

    expect(screen.getByText("No hospital holidays in this period.")).toBeInTheDocument();
  });

  it("names the doctor on each blocking appointment", async () => {
    const user = userEvent.setup();
    vi.mocked(adminAddHolidayAction).mockResolvedValue({
      status: "error",
      message:
        "This exception covers 1 existing appointment. Ask the front desk to reschedule or cancel it first.",
      conflicts: [
        {
          appointmentId: "00000000-0000-4000-8000-000000000201",
          scheduledAt: "2026-11-02T01:00:00.000Z",
          status: "requested",
          doctorName: "Dr. Maya Santos",
        },
      ],
    });
    render(<ScheduleExceptionsSection editor="holiday" exceptions={[]} />);

    await submitException(user, "Add holiday");

    const blocking = await screen.findByRole("list", { name: "Blocking appointments" });
    expect(within(blocking).getByText("Dr. Maya Santos")).toBeInTheDocument();
    expect(adminAddHolidayAction).toHaveBeenCalled();
  });
});
