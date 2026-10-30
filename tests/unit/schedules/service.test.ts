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
    listExceptionsForDoctor: vi.fn().mockResolvedValue([]),
    createSchedulePeriod: vi.fn().mockResolvedValue("saved"),
    updateSchedulePeriod: vi.fn().mockResolvedValue("saved"),
    addException: vi.fn().mockResolvedValue(undefined),
    removeException: vi.fn().mockResolvedValue(true),
    listActiveIntervals: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveSchedulePeriod", () => {
  it("adds a second consultation period on the same day", async () => {
    const store = createStore();

    await expect(
      saveSchedulePeriod(
        { doctorId: DOCTOR_ID, periodId: null, period: AFTERNOON_PERIOD, now: NOW },
        store,
      ),
    ).resolves.toEqual({ ok: true, message: "Consultation hours saved." });
    expect(store.createSchedulePeriod).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      ...AFTERNOON_PERIOD,
    });
  });

  it("rejects a period that overlaps an active one", async () => {
    const store = createStore();

    await expect(
      saveSchedulePeriod(
        {
          doctorId: DOCTOR_ID,
          periodId: null,
          period: { ...AFTERNOON_PERIOD, startTime: "11:00" },
          now: NOW,
        },
        store,
      ),
    ).resolves.toEqual({
      ok: false,
      message: "This overlaps the Monday 08:00–12:00 period.",
    });
    expect(store.createSchedulePeriod).not.toHaveBeenCalled();
  });

  it("maps a database overlap race to the same friendly error", async () => {
    const store = createStore({
      createSchedulePeriod: vi.fn().mockResolvedValue("overlap"),
    });

    await expect(
      saveSchedulePeriod(
        { doctorId: DOCTOR_ID, periodId: null, period: AFTERNOON_PERIOD, now: NOW },
        store,
      ),
    ).resolves.toEqual({
      ok: false,
      message: "This overlaps another active period on that day.",
    });
  });

  it("updates a period only within the doctor's own schedule", async () => {
    const store = createStore();

    await saveSchedulePeriod(
      {
        doctorId: DOCTOR_ID,
        periodId: PERIOD_ID,
        period: { ...AFTERNOON_PERIOD, startTime: "07:00", endTime: "12:00" },
        now: NOW,
      },
      store,
    );

    expect(store.listSchedulesForDoctor).toHaveBeenCalledWith(DOCTOR_ID);
    expect(store.updateSchedulePeriod).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: DOCTOR_ID, periodId: PERIOD_ID }),
    );
  });

  it("rejects editing a period that is not in the doctor's schedule", async () => {
    const store = createStore();

    await expect(
      saveSchedulePeriod(
        {
          doctorId: DOCTOR_ID,
          periodId: "00000000-0000-4000-8000-0000000009ff",
          period: AFTERNOON_PERIOD,
          now: NOW,
        },
        store,
      ),
    ).resolves.toEqual({ ok: false, message: "That schedule period no longer exists." });
    expect(store.updateSchedulePeriod).not.toHaveBeenCalled();
  });

  it("keeps existing appointments and reports those now outside hours", async () => {
    const store = createStore({
      listSchedulesForDoctor: vi
        .fn()
        .mockResolvedValueOnce([MONDAY_MORNING])
        .mockResolvedValueOnce([{ ...MONDAY_MORNING, isActive: false }]),
      listActiveIntervals: vi.fn().mockResolvedValue([
        { start: "2026-11-02T01:00:00.000Z", end: "2026-11-02T01:30:00.000Z" },
      ]),
    });

    const result = await saveSchedulePeriod(
      {
        doctorId: DOCTOR_ID,
        periodId: PERIOD_ID,
        period: { ...AFTERNOON_PERIOD, startTime: "08:00", endTime: "12:00", isActive: false },
        now: NOW,
      },
      store,
    );

    expect(result).toEqual({
      ok: true,
      message:
        "Consultation hours saved. 1 existing appointment now falls outside these hours and was kept; review it in the appointment list.",
    });
    expect(store.listActiveIntervals).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: DOCTOR_ID, start: NOW.toISOString() }),
    );
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
