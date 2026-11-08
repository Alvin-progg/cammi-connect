import { describe, expect, it } from "vitest";

import {
  byDoctor,
  computeKpis,
  dailyVolume,
  dashboardCards,
  DAYTIME_SLOTS,
  deriveAnalyticsRow,
  heatmap,
  monthlyVolume,
  outcomesByMonth,
  rate,
  ratesByWeekday,
  shortDoctorNames,
  statusDistribution,
  trendPercent,
  type AnalyticsAppointment,
} from "@/lib/analytics/metrics";
import type { AppointmentStatus } from "@/lib/appointments/status";

/** Manila noon, 2026-11-05. */
const NOW = new Date("2026-11-05T04:00:00.000Z");

const DOCTOR_A = { doctorId: "00000000-0000-4000-8000-00000000000a", doctorName: "Dr. Synthetic Alpha" };
const DOCTOR_B = { doctorId: "00000000-0000-4000-8000-00000000000b", doctorName: "Dr. Synthetic Beta" };

let nextId = 0;

function appointment(
  doctor: typeof DOCTOR_A,
  scheduledAt: string,
  status: AppointmentStatus,
  evidence: { confirmedAt?: string | null; confirmedInAudit?: boolean; cancelledAt?: string | null } = {},
): AnalyticsAppointment {
  nextId += 1;
  const start = new Date(scheduledAt);
  return {
    id: `appointment-${nextId}`,
    ...doctor,
    scheduledAt: start.toISOString(),
    scheduledEndAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
    status,
    confirmedAt: evidence.confirmedAt ?? null,
    confirmedInAudit: evidence.confirmedInAudit ?? false,
    cancelledAt: evidence.cancelledAt ?? null,
  };
}

function times<T>(count: number, make: () => T): T[] {
  return Array.from({ length: count }, make);
}

const CONFIRMED = { confirmedAt: "2026-09-30T02:00:00.000Z" };
/** Monday 09:00 Manila. */
const A_OCT = "2026-10-05T01:00:00.000Z";
/** Wednesday 14:00 Manila. */
const B_OCT = "2026-10-07T06:00:00.000Z";
/** Saturday 2026-10-31 23:30 Manila: the last half hour of October. */
const OCT_31_LATE = "2026-10-31T15:30:00.000Z";
/** Sunday 2026-11-01 00:30 Manila: UTC still says October 31. */
const NOV_1_EARLY = "2026-10-31T16:30:00.000Z";
/** Monday 10:00 Manila, after NOW. */
const A_NOV_FUTURE = "2026-11-16T02:00:00.000Z";
/** Friday 09:00 Manila, after NOW. */
const B_NOV_FUTURE = "2026-11-20T01:00:00.000Z";

/**
 * 35 synthetic appointments with hand-computed expectations.
 * Doctor A, October (all past): 10 completed, 3 no-show, 2 cancelled after
 * confirmation, 1 cancelled while still requested, 2 rejected, 1 stale
 * request, 1 checked in with no confirmation record.
 * Doctor B, October: 5 completed (one at 23:30 on the 31st), 1 no-show,
 * 1 cancelled after an audit-only confirmation, 1 confirmed and past.
 * November: A has 3 confirmed and 2 requested in the future; B has a
 * completed visit at 00:30 on the 1st and a future confirmed one.
 */
const FIXTURE: AnalyticsAppointment[] = [
  ...times(10, () => appointment(DOCTOR_A, A_OCT, "completed", CONFIRMED)),
  ...times(3, () => appointment(DOCTOR_A, A_OCT, "no_show", CONFIRMED)),
  ...times(2, () =>
    appointment(DOCTOR_A, A_OCT, "cancelled", { ...CONFIRMED, cancelledAt: "2026-10-04T02:00:00.000Z" }),
  ),
  appointment(DOCTOR_A, A_OCT, "cancelled", { cancelledAt: "2026-10-03T02:00:00.000Z" }),
  ...times(2, () => appointment(DOCTOR_A, A_OCT, "rejected")),
  appointment(DOCTOR_A, A_OCT, "requested"),
  appointment(DOCTOR_A, A_OCT, "checked_in"),
  ...times(4, () => appointment(DOCTOR_B, B_OCT, "completed", CONFIRMED)),
  appointment(DOCTOR_B, OCT_31_LATE, "completed", CONFIRMED),
  appointment(DOCTOR_B, B_OCT, "no_show", CONFIRMED),
  appointment(DOCTOR_B, B_OCT, "cancelled", { confirmedInAudit: true, cancelledAt: "2026-10-06T02:00:00.000Z" }),
  appointment(DOCTOR_B, B_OCT, "confirmed", CONFIRMED),
  ...times(3, () => appointment(DOCTOR_A, A_NOV_FUTURE, "confirmed", CONFIRMED)),
  ...times(2, () => appointment(DOCTOR_A, A_NOV_FUTURE, "requested")),
  appointment(DOCTOR_B, NOV_1_EARLY, "completed", CONFIRMED),
  appointment(DOCTOR_B, B_NOV_FUTURE, "confirmed", CONFIRMED),
];

describe("rate", () => {
  it("returns a percentage rounded to 2 decimals", () => {
    expect(rate(1, 3)).toBe(33.33);
    expect(rate(2, 3)).toBe(66.67);
    expect(rate(3, 16)).toBe(18.75);
  });

  it("returns null, not 0, when the denominator is 0", () => {
    expect(rate(0, 0)).toBeNull();
  });
});

describe("deriveAnalyticsRow", () => {
  it("buckets 23:30 Manila on October 31 into October, Saturday, outside the daytime slots", () => {
    const row = appointment(DOCTOR_B, OCT_31_LATE, "completed", CONFIRMED);

    expect(deriveAnalyticsRow(row, NOW)).toEqual({
      schedDateMnl: "2026-10-31",
      schedMonth: "2026-10",
      weekday: "Sat",
      slot: null,
      isOutcome: true,
    });
  });

  it("buckets 00:30 Manila on November 1 into November although UTC is still October", () => {
    const derived = deriveAnalyticsRow(appointment(DOCTOR_B, NOV_1_EARLY, "completed"), NOW);

    expect(derived.schedDateMnl).toBe("2026-11-01");
    expect(derived.schedMonth).toBe("2026-11");
    expect(derived.weekday).toBe("Sun");
    expect(derived.slot).toBeNull();
  });

  it("puts Manila start hours into the four daytime slots", () => {
    // 09:00, 10:59, 11:00, 13:00, 15:00, and 16:59 Manila on Monday 2026-10-05.
    const slotAt = (utc: string) => deriveAnalyticsRow(appointment(DOCTOR_A, utc, "completed"), NOW).slot;
    expect(slotAt("2026-10-05T01:00:00.000Z")).toBe("9–11 AM");
    expect(slotAt("2026-10-05T02:59:00.000Z")).toBe("9–11 AM");
    expect(slotAt("2026-10-05T03:00:00.000Z")).toBe("11 AM–1 PM");
    expect(slotAt("2026-10-05T05:00:00.000Z")).toBe("1–3 PM");
    expect(slotAt("2026-10-05T07:00:00.000Z")).toBe("3–5 PM");
    expect(slotAt("2026-10-05T08:59:00.000Z")).toBe("3–5 PM");
    expect(slotAt("2026-10-05T00:59:00.000Z")).toBeNull();
    expect(slotAt("2026-10-05T09:00:00.000Z")).toBeNull();
  });

  it("is an outcome only once the appointment has ended as completed, cancelled, or no-show", () => {
    expect(
      deriveAnalyticsRow(appointment(DOCTOR_A, "2026-11-05T03:30:00.000Z", "completed"), NOW).isOutcome,
    ).toBe(false);
    expect(
      deriveAnalyticsRow(appointment(DOCTOR_A, "2026-11-05T03:29:00.000Z", "completed"), NOW).isOutcome,
    ).toBe(true);
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      expect(deriveAnalyticsRow(appointment(DOCTOR_A, A_OCT, status), NOW).isOutcome).toBe(true);
    }
    for (const status of ["requested", "rejected", "confirmed", "checked_in"] as const) {
      expect(deriveAnalyticsRow(appointment(DOCTOR_A, A_OCT, status, CONFIRMED), NOW).isOutcome).toBe(false);
    }
  });
});

describe("computeKpis", () => {
  it("returns the exact fixture KPIs over the outcome cohort", () => {
    expect(computeKpis(FIXTURE, NOW)).toEqual({
      total: 33,
      outcomeCount: 24,
      completed: 16,
      cancelled: 4,
      noShow: 4,
      completionRate: 66.67,
      cancellationRate: 16.67,
      noShowRate: 16.67,
      outcomeMonths: { first: "2026-10", last: "2026-11" },
      busiestMonth: { month: "2026-10", total: 26 },
      peakSlot: { weekday: "Mon", slot: "9–11 AM", count: 23 },
    });
  });

  it("adds completed, cancelled, and no-show up to the outcome count", () => {
    const kpis = computeKpis(FIXTURE, NOW);
    expect(kpis.completed + kpis.cancelled + kpis.noShow).toBe(kpis.outcomeCount);
  });

  it("returns null rates and no outcome months when nothing has an outcome yet", () => {
    const futureOnly = FIXTURE.filter((row) => row.scheduledAt === A_NOV_FUTURE);

    expect(computeKpis(futureOnly, NOW)).toMatchObject({
      total: 5,
      outcomeCount: 0,
      completionRate: null,
      cancellationRate: null,
      noShowRate: null,
      outcomeMonths: null,
      busiestMonth: { month: "2026-11", total: 5 },
      peakSlot: { weekday: "Mon", slot: "9–11 AM", count: 5 },
    });
    expect(computeKpis([], NOW)).toMatchObject({ total: 0, busiestMonth: null, peakSlot: null });
  });

  it("is unaffected by pending and rejected appointments", () => {
    const withoutPendingOrRejected = FIXTURE.filter(
      (row) => row.status !== "requested" && row.status !== "rejected",
    );
    const extra = [
      ...times(5, () => appointment(DOCTOR_A, A_OCT, "requested", CONFIRMED)),
      ...times(5, () => appointment(DOCTOR_A, A_OCT, "rejected", CONFIRMED)),
    ];

    const base = computeKpis(withoutPendingOrRejected, NOW);
    const noisy = computeKpis([...withoutPendingOrRejected, ...extra], NOW);

    expect(noisy.completionRate).toBe(base.completionRate);
    expect(noisy.noShowRate).toBe(base.noShowRate);
    expect(noisy.cancellationRate).toBe(base.cancellationRate);
    expect(noisy.outcomeCount).toBe(base.outcomeCount);
  });
});

describe("monthlyVolume", () => {
  it("counts non-rejected appointments per Manila month, with empty months as 0", () => {
    expect(monthlyVolume(FIXTURE, ["2026-09", "2026-10", "2026-11"])).toEqual([
      { month: "2026-09", total: 0 },
      { month: "2026-10", total: 26 },
      { month: "2026-11", total: 7 },
    ]);
  });
});

describe("byDoctor", () => {
  it("returns volume and outcome-cohort rates per doctor, busiest first", () => {
    expect(byDoctor(FIXTURE, NOW)).toEqual([
      { ...DOCTOR_A, shortName: "Alpha", total: 23, outcomeCount: 16, cancellationRate: 18.75, noShowRate: 18.75 },
      { ...DOCTOR_B, shortName: "Beta", total: 10, outcomeCount: 8, cancellationRate: 12.5, noShowRate: 12.5 },
    ]);
  });

  it("orders doctors with equal volume by name", () => {
    const rows = [
      appointment({ doctorId: "z", doctorName: "Dr. Zed" }, A_OCT, "completed"),
      appointment({ doctorId: "y", doctorName: "Dr. Ann" }, A_OCT, "completed"),
    ];

    expect(byDoctor(rows, NOW).map((row) => row.doctorName)).toEqual(["Dr. Ann", "Dr. Zed"]);
  });
});

describe("shortDoctorNames", () => {
  it("uses the surname, adding the first initial when surnames repeat", () => {
    expect(
      shortDoctorNames(["Dr. Ana Reyes", "Dr. Grace Lim", "Dr. Joy Lim", "Dr. Carlo Villanueva", "Mendoza"]),
    ).toEqual(["Reyes", "G. Lim", "J. Lim", "Villanueva", "Mendoza"]);
  });
});

describe("heatmap", () => {
  it("counts non-rejected appointments per weekday and daytime slot, Mon–Fri always shown", () => {
    const { cells, outsideHours } = heatmap(FIXTURE);
    const count = (weekday: string, slot: string) =>
      cells.find((cell) => cell.weekday === weekday && cell.slot === slot)?.count;

    expect(cells).toHaveLength(5 * DAYTIME_SLOTS.length);
    expect(cells[0]).toEqual({ weekday: "Mon", slot: "9–11 AM", count: 23 });
    expect(count("Wed", "1–3 PM")).toBe(7);
    expect(count("Fri", "9–11 AM")).toBe(1);
    expect(count("Tue", "9–11 AM")).toBe(0);
    // Saturday 23:30 and Sunday 00:30 fall outside the daytime slots.
    expect(outsideHours).toBe(2);
    expect(cells.reduce((sum, cell) => sum + cell.count, 0) + outsideHours).toBe(33);
  });

  it("adds Saturday or Sunday rows only when they have daytime appointments", () => {
    // Saturday 2026-10-10, 10:00 Manila.
    const { cells } = heatmap([appointment(DOCTOR_A, "2026-10-10T02:00:00.000Z", "completed")]);
    expect([...new Set(cells.map((cell) => cell.weekday))]).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});

describe("outcomesByMonth", () => {
  it("counts completed, cancelled, and no-show per month across the outcome months", () => {
    expect(outcomesByMonth(FIXTURE, ["2026-09", "2026-10", "2026-11", "2026-12"], NOW)).toEqual([
      { month: "2026-10", completed: 15, cancelled: 4, noShow: 4 },
      { month: "2026-11", completed: 1, cancelled: 0, noShow: 0 },
    ]);
  });

  it("is empty when nothing has an outcome", () => {
    expect(outcomesByMonth([], ["2026-10"], NOW)).toEqual([]);
  });
});

describe("ratesByWeekday", () => {
  it("returns outcome-cohort rates for each weekday that has outcomes, Monday first", () => {
    expect(ratesByWeekday(FIXTURE, NOW)).toEqual([
      { weekday: "Mon", outcomeCount: 16, cancellationRate: 18.75, noShowRate: 18.75 },
      { weekday: "Wed", outcomeCount: 6, cancellationRate: 16.67, noShowRate: 16.67 },
      { weekday: "Sat", outcomeCount: 1, cancellationRate: 0, noShowRate: 0 },
      { weekday: "Sun", outcomeCount: 1, cancellationRate: 0, noShowRate: 0 },
    ]);
  });
});

describe("statusDistribution", () => {
  it("counts every non-rejected appointment by current status", () => {
    expect(statusDistribution(FIXTURE)).toEqual({
      requested: 3,
      confirmed: 5,
      cancelled: 4,
      checked_in: 1,
      completed: 16,
      no_show: 4,
    });
  });
});

describe("dashboardCards", () => {
  it("counts scheduled-date cards from the rows and takes cancellations by cancellation date", () => {
    // 4 rows in the fixture are cancelled, but the card uses the separate cancellation-date count (D4).
    expect(dashboardCards(FIXTURE, 7)).toEqual({
      total: 33,
      confirmed: 5,
      completed: 16,
      noShow: 4,
      cancelled: 7,
    });
  });

  it("is all zero with no appointments", () => {
    expect(dashboardCards([], 0)).toEqual({ total: 0, confirmed: 0, completed: 0, noShow: 0, cancelled: 0 });
  });
});

describe("dailyVolume", () => {
  it("counts non-rejected appointments per Manila day, zero-filling the given days", () => {
    const rows = [...FIXTURE, appointment(DOCTOR_B, OCT_31_LATE, "rejected")];
    expect(dailyVolume(rows, ["2026-10-30", "2026-10-31", "2026-11-01"])).toEqual([
      { date: "2026-10-30", total: 0 },
      // 23:30 Manila on the 31st stays on the 31st; 00:30 Manila on the 1st is the 1st.
      { date: "2026-10-31", total: 1 },
      { date: "2026-11-01", total: 1 },
    ]);
  });
});

describe("trendPercent", () => {
  it("is the percent change from the previous period, or null with nothing to compare", () => {
    expect(trendPercent(15, 10)).toBe(50);
    expect(trendPercent(5, 10)).toBe(-50);
    expect(trendPercent(1, 3)).toBe(-66.67);
    expect(trendPercent(4, 0)).toBeNull();
  });
});
