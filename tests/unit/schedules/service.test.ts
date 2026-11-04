// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WeeklySchedule } from "@/lib/schedules/types";
import {
  addScheduleException,
  removeScheduleException,
  saveSchedulePeriod,
  type DoctorSchedulesStore,
} from "@/server/schedules/service";

vi.mock("server-only", () => ({}));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const ACTOR_ID = "00000000-0000-4000-8000-000000000001";
const PERIOD_ID = "00000000-0000-4000-8000-000000000901";
// 2026-11-02 is a Monday in Asia/Manila.
const NOW = new Date("2026-11-01T12:00:00+08:00");

const MONDAY_MORNING: WeeklySchedule = {
  id: PERIOD_ID,
  doctorId: DOCTOR_ID,
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "12:00",
  slotDurationMinutes: 30,
  effectiveFrom: "2026-01-01",
  effectiveUntil: null,
  isActive: true,
};

const AFTERNOON_PERIOD = {
  dayOfWeek: 1,
  startTime: "13:00",
  endTime: "17:00",
  slotDurationMinutes: 30,
  effectiveFrom: "2026-11-01",
  effectiveUntil: null,
  isActive: true,
};

function createStore(overrides: Partial<DoctorSchedulesStore> = {}): DoctorSchedulesStore {
  return {
    listSchedulesForDoctor: vi.fn().mockResolvedValue([MONDAY_MORNING]),
    listSchedulesForDoctors: vi.fn().mockResolvedValue([MONDAY_MORNING]),
    listExceptionsForDoctor: vi.fn().mockResolvedValue([]),
    savePeriod: vi.fn().mockResolvedValue({ ok: true }),
    listUpcomingAppointments: vi.fn().mockResolvedValue([]),
    addException: vi.fn().mockResolvedValue(undefined),
    removeException: vi.fn().mockResolvedValue(true),
    listActiveIntervals: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// A confirmed Monday 09:00–09:30 appointment, inside MONDAY_MORNING.
const MONDAY_BOOKING = {
  appointmentId: "00000000-0000-4000-8000-000000000201",
  scheduledAt: "2026-11-02T01:00:00.000Z",
  scheduledEndAt: "2026-11-02T01:30:00.000Z",
  status: "confirmed" as const,
};

const MONDAY_CONFLICT = {
  appointmentId: MONDAY_BOOKING.appointmentId,
  scheduledAt: MONDAY_BOOKING.scheduledAt,
  status: MONDAY_BOOKING.status,
};

const ORPHAN_MESSAGE =
  "This change would leave 1 upcoming appointment outside the doctor's hours. Ask the front desk to reschedule or cancel it first, or end-date this period and add a new one.";

function save(
  store: DoctorSchedulesStore,
  overrides: Partial<Parameters<typeof saveSchedulePeriod>[0]> = {},
) {
  return saveSchedulePeriod(
    {
      actorId: ACTOR_ID,
      doctorId: DOCTOR_ID,
      periodId: null,
      period: AFTERNOON_PERIOD,
      now: NOW,
      ...overrides,
    },
    store,
  );
}

describe("saveSchedulePeriod", () => {
  it("adds a second consultation period on the same day as the acting user", async () => {
    const store = createStore();

    await expect(save(store)).resolves.toEqual({ ok: true, message: "Consultation hours saved." });
    expect(store.savePeriod).toHaveBeenCalledWith({
      actorId: ACTOR_ID,
      doctorId: DOCTOR_ID,
      periodId: null,
      ...AFTERNOON_PERIOD,
    });
  });

  it("rejects a period that overlaps an active one", async () => {
    const store = createStore();

    await expect(
      save(store, { period: { ...AFTERNOON_PERIOD, startTime: "11:00" } }),
    ).resolves.toEqual({
      ok: false,
      message: "This overlaps the Monday 08:00–12:00 period.",
    });
    expect(store.savePeriod).not.toHaveBeenCalled();
  });

  it("maps a database overlap race to the same friendly error", async () => {
    const store = createStore({
      savePeriod: vi.fn().mockResolvedValue({ ok: false, code: "overlap" }),
    });

    await expect(save(store)).resolves.toEqual({
      ok: false,
      message: "This overlaps another active period on that day.",
    });
  });

  it("updates a period only within the doctor's own schedule", async () => {
    const store = createStore();

    await save(store, {
      periodId: PERIOD_ID,
      period: { ...AFTERNOON_PERIOD, startTime: "07:00", endTime: "12:00" },
    });

    expect(store.listSchedulesForDoctor).toHaveBeenCalledWith(DOCTOR_ID);
    expect(store.savePeriod).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ACTOR_ID, doctorId: DOCTOR_ID, periodId: PERIOD_ID }),
    );
  });

  it("rejects editing a period that is not in the doctor's schedule", async () => {
    const store = createStore();

    await expect(
      save(store, { periodId: "00000000-0000-4000-8000-0000000009ff" }),
    ).resolves.toEqual({ ok: false, message: "That schedule period no longer exists." });
    expect(store.savePeriod).not.toHaveBeenCalled();
  });

  it("maps a period removed meanwhile to not found", async () => {
    const store = createStore({
      savePeriod: vi.fn().mockResolvedValue({ ok: false, code: "not_found" }),
    });

    await expect(save(store, { periodId: PERIOD_ID })).resolves.toEqual({
      ok: false,
      message: "That schedule period no longer exists.",
    });
  });

  it("refuses an edit that leaves an upcoming appointment outside the hours, listing it without writing", async () => {
    const store = createStore({
      listUpcomingAppointments: vi.fn().mockResolvedValue([MONDAY_BOOKING]),
    });

    await expect(
      save(store, {
        periodId: PERIOD_ID,
        period: { ...AFTERNOON_PERIOD, startTime: "10:00", endTime: "12:00" },
      }),
    ).resolves.toEqual({ ok: false, message: ORPHAN_MESSAGE, conflicts: [MONDAY_CONFLICT] });
    expect(store.listUpcomingAppointments).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      from: NOW.toISOString(),
    });
    expect(store.savePeriod).not.toHaveBeenCalled();
  });

  it("refuses deactivating a period that holds an upcoming appointment", async () => {
    const store = createStore({
      listUpcomingAppointments: vi.fn().mockResolvedValue([MONDAY_BOOKING]),
    });

    await expect(
      save(store, {
        periodId: PERIOD_ID,
        period: { ...AFTERNOON_PERIOD, startTime: "08:00", endTime: "12:00", isActive: false },
      }),
    ).resolves.toEqual({ ok: false, message: ORPHAN_MESSAGE, conflicts: [MONDAY_CONFLICT] });
    expect(store.savePeriod).not.toHaveBeenCalled();
  });

  it("allows an edit that keeps every upcoming appointment inside the hours", async () => {
    const store = createStore({
      listUpcomingAppointments: vi.fn().mockResolvedValue([MONDAY_BOOKING]),
    });

    await expect(
      save(store, {
        periodId: PERIOD_ID,
        period: { ...AFTERNOON_PERIOD, startTime: "07:00", endTime: "12:00" },
      }),
    ).resolves.toEqual({ ok: true, message: "Consultation hours saved." });
  });

  it("does not let an appointment already outside the hours block an unrelated edit", async () => {
    // Monday 18:00–18:30 Manila: outside every period before and after the save.
    const legacy = {
      ...MONDAY_BOOKING,
      appointmentId: "00000000-0000-4000-8000-000000000202",
      scheduledAt: "2026-11-02T10:00:00.000Z",
      scheduledEndAt: "2026-11-02T10:30:00.000Z",
    };
    const store = createStore({
      listUpcomingAppointments: vi.fn().mockResolvedValue([legacy]),
    });

    await expect(save(store)).resolves.toEqual({ ok: true, message: "Consultation hours saved." });
    expect(store.savePeriod).toHaveBeenCalled();
  });

  it("lists the conflicts when the database refuses a booking that slipped in", async () => {
    const store = createStore({
      listUpcomingAppointments: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([MONDAY_BOOKING]),
      savePeriod: vi.fn().mockResolvedValue({ ok: false, code: "orphans_appointments" }),
    });

    await expect(
      save(store, {
        periodId: PERIOD_ID,
        period: { ...AFTERNOON_PERIOD, startTime: "10:00", endTime: "12:00" },
      }),
    ).resolves.toEqual({ ok: false, message: ORPHAN_MESSAGE, conflicts: [MONDAY_CONFLICT] });
  });

  it("hides unexpected database refusals behind a generic message", async () => {
    const store = createStore({
      savePeriod: vi.fn().mockResolvedValue({ ok: false, code: undefined }),
    });

    await expect(save(store)).resolves.toEqual({
      ok: false,
      message: "Something went wrong. Try again.",
    });
  });
});

describe("addScheduleException", () => {
  const LEAVE = {
    start: new Date("2026-11-02T00:00:00+08:00"),
    end: new Date("2026-11-03T00:00:00+08:00"),
    exceptionType: "leave" as const,
    reason: "Annual leave",
  };

  it("stores a typed exception for the doctor", async () => {
    const store = createStore();

    await expect(
      addScheduleException({ doctorId: DOCTOR_ID, ...LEAVE }, store),
    ).resolves.toEqual({ ok: true, message: "Exception added." });
    expect(store.addException).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      startsAt: LEAVE.start.toISOString(),
      endsAt: LEAVE.end.toISOString(),
      exceptionType: "leave",
      reason: "Annual leave",
    });
  });

  it("reports existing appointments inside the exception without changing them", async () => {
    const store = createStore({
      listActiveIntervals: vi.fn().mockResolvedValue([
        { start: "2026-11-02T01:00:00.000Z", end: "2026-11-02T01:30:00.000Z" },
        { start: "2026-11-02T02:00:00.000Z", end: "2026-11-02T02:30:00.000Z" },
      ]),
    });

    await expect(
      addScheduleException({ doctorId: DOCTOR_ID, ...LEAVE }, store),
    ).resolves.toEqual({
      ok: true,
      message:
        "Exception added. 2 existing appointments fall inside it and were kept; review them in the appointment list.",
    });
  });
});

describe("removeScheduleException", () => {
  it("reports a missing exception", async () => {
    const store = createStore({ removeException: vi.fn().mockResolvedValue(false) });

    await expect(
      removeScheduleException({ doctorId: DOCTOR_ID, exceptionId: PERIOD_ID }, store),
    ).resolves.toEqual({ ok: false, message: "That exception was already removed." });
    expect(store.removeException).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      exceptionId: PERIOD_ID,
    });
  });
});
