import { describe, expect, it } from "vitest";

import {
  countAppointmentsOutsideSchedule,
  findOverlappingPeriod,
} from "@/lib/schedules/periods";
import type { WeeklySchedule } from "@/lib/schedules/types";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";

function schedule(overrides: Partial<WeeklySchedule> = {}): WeeklySchedule {
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

const EXISTING = schedule();

describe("findOverlappingPeriod", () => {
  it("allows a second period later the same day", () => {
    expect(
      findOverlappingPeriod(
        schedule({ id: undefined, startTime: "13:00", endTime: "17:00" }),
        [EXISTING],
      ),
    ).toBeNull();
  });

  it("allows periods that touch end-to-start", () => {
    expect(
      findOverlappingPeriod(
        schedule({ id: undefined, startTime: "12:00", endTime: "13:00" }),
        [EXISTING],
      ),
    ).toBeNull();
  });

  it("finds an overlapping period on the same weekday", () => {
    expect(
      findOverlappingPeriod(
        schedule({ id: undefined, startTime: "11:00", endTime: "14:00" }),
        [EXISTING],
      ),
    ).toBe(EXISTING);
  });

  it("ignores other weekdays, inactive periods, and the period being edited", () => {
    const candidate = schedule({ startTime: "09:00", endTime: "10:00" });
    expect(
      findOverlappingPeriod(candidate, [
        EXISTING,
        schedule({ id: "other-day", dayOfWeek: 2 }),
        schedule({ id: "inactive", isActive: false }),
      ]),
    ).toBeNull();
  });

  it("ignores an inactive candidate", () => {
    expect(
      findOverlappingPeriod(
        schedule({ id: undefined, isActive: false }),
        [EXISTING],
      ),
    ).toBeNull();
  });

  it("allows the same hours in non-overlapping effective ranges", () => {
    const ended = schedule({ effectiveUntil: "2026-10-31" });
    expect(
      findOverlappingPeriod(
        schedule({ id: undefined, effectiveFrom: "2026-11-01" }),
        [ended],
      ),
    ).toBeNull();
    expect(
      findOverlappingPeriod(
        schedule({ id: undefined, effectiveFrom: "2026-10-31" }),
        [ended],
      ),
    ).toBe(ended);
  });
});

describe("countAppointmentsOutsideSchedule", () => {
  // 2026-11-02 is a Monday in Asia/Manila.
  const inside = {
    start: new Date("2026-11-02T09:00:00+08:00"),
    end: new Date("2026-11-02T09:30:00+08:00"),
  };
  const outside = {
    start: new Date("2026-11-02T14:00:00+08:00"),
    end: new Date("2026-11-02T14:30:00+08:00"),
  };

  it("counts appointments no period covers", () => {
    expect(countAppointmentsOutsideSchedule([inside, outside], [EXISTING])).toBe(1);
  });

  it("counts every appointment when no period is active", () => {
    expect(
      countAppointmentsOutsideSchedule(
        [inside, outside],
        [schedule({ isActive: false })],
      ),
    ).toBe(2);
  });
});
