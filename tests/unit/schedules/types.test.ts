import { describe, expect, it } from "vitest";

import {
  formatScheduleSummary,
  isScheduleEffectiveOn,
  type WeeklySchedule,
} from "@/lib/schedules/types";

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

describe("isScheduleEffectiveOn", () => {
  it("includes both boundary dates", () => {
    const period = { effectiveFrom: "2026-11-02", effectiveUntil: "2026-11-09" };
    expect(isScheduleEffectiveOn(period, "2026-11-01")).toBe(false);
    expect(isScheduleEffectiveOn(period, "2026-11-02")).toBe(true);
    expect(isScheduleEffectiveOn(period, "2026-11-09")).toBe(true);
    expect(isScheduleEffectiveOn(period, "2026-11-10")).toBe(false);
  });

  it("treats a null effective-until as open-ended", () => {
    expect(
      isScheduleEffectiveOn(
        { effectiveFrom: "2026-01-01", effectiveUntil: null },
        "2099-12-31",
      ),
    ).toBe(true);
  });
});

describe("formatScheduleSummary", () => {
  it("groups several periods on the same weekday", () => {
    expect(
      formatScheduleSummary(
        [
          schedule({ dayOfWeek: 2, startTime: "09:00", endTime: "12:00" }),
          schedule({ startTime: "13:00", endTime: "17:00" }),
          schedule(),
        ],
        "2026-11-02",
      ),
    ).toBe("Mon 08:00–12:00, 13:00–17:00 · Tue 09:00–12:00");
  });

  it("leaves out inactive periods and periods not effective today", () => {
    expect(
      formatScheduleSummary(
        [
          schedule({ isActive: false }),
          schedule({ effectiveFrom: "2026-12-01" }),
        ],
        "2026-11-02",
      ),
    ).toBe("No regular consultation hours set.");
  });
});
