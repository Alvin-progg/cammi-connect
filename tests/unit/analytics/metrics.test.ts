import { describe, expect, it } from "vitest";

import {
  byDoctor,
  computeKpis,
  deriveAnalyticsRow,
  heatmap,
  HOUR_BUCKETS,
  monthlyVolume,
  rate,
  ratesBySlot,
  statusByMonth,
  WEEKDAYS,
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
  it("buckets 23:30 Manila on October 31 into October, Saturday, 22–24", () => {
    const row = appointment(DOCTOR_B, OCT_31_LATE, "completed", CONFIRMED);

    expect(deriveAnalyticsRow(row, NOW)).toEqual({
      schedDateMnl: "2026-10-31",
      schedMonth: "2026-10",
      weekday: "Sat",
      hourBucket: "22–24",
      wasConfirmed: true,
      isDue: true,
    });
  });

  it("buckets 00:30 Manila on November 1 into November although UTC is still October", () => {
    const derived = deriveAnalyticsRow(appointment(DOCTOR_B, NOV_1_EARLY, "completed"), NOW);

    expect(derived.schedDateMnl).toBe("2026-11-01");
    expect(derived.schedMonth).toBe("2026-11");
    expect(derived.weekday).toBe("Sun");
    expect(derived.hourBucket).toBe("00–02");
  });

  it("treats confirmation evidence from confirmed_at, the audit log, or an attended status", () => {
    expect(deriveAnalyticsRow(appointment(DOCTOR_A, A_OCT, "cancelled", CONFIRMED), NOW).wasConfirmed).toBe(true);
    expect(
      deriveAnalyticsRow(appointment(DOCTOR_A, A_OCT, "cancelled", { confirmedInAudit: true }), NOW).wasConfirmed,
    ).toBe(true);
    for (const status of ["checked_in", "completed", "no_show"] as const) {
      expect(deriveAnalyticsRow(appointment(DOCTOR_A, A_OCT, status), NOW).wasConfirmed).toBe(true);
    }
    expect(deriveAnalyticsRow(appointment(DOCTOR_A, A_OCT, "cancelled"), NOW).wasConfirmed).toBe(false);
  });

  it("is due only once the appointment has ended", () => {
    const endsAtNow = appointment(DOCTOR_A, "2026-11-05T03:30:00.000Z", "confirmed", CONFIRMED);
    const endsAfterNow = appointment(DOCTOR_A, "2026-11-05T03:31:00.000Z", "confirmed", CONFIRMED);

    expect(deriveAnalyticsRow(endsAtNow, NOW).isDue).toBe(false);
    expect(deriveAnalyticsRow(endsAfterNow, NOW).isDue).toBe(false);
    expect(
      deriveAnalyticsRow(appointment(DOCTOR_A, "2026-11-05T03:29:00.000Z", "confirmed", CONFIRMED), NOW).isDue,
    ).toBe(true);
  });

  it("never puts pending or rejected appointments in the due cohort", () => {
    expect(deriveAnalyticsRow(appointment(DOCTOR_A, A_OCT, "requested", CONFIRMED), NOW).isDue).toBe(false);
    expect(deriveAnalyticsRow(appointment(DOCTOR_A, A_OCT, "rejected", CONFIRMED), NOW).isDue).toBe(false);
  });
});

describe("computeKpis", () => {
  it("returns the exact fixture KPIs", () => {
    expect(computeKpis(FIXTURE, NOW)).toEqual({
      total: 33,
      dueCount: 25,
      completionRate: 64,
      noShowRate: 16,
      cancellationRate: 12,
    });
  });

  it("returns null rates when nothing is due", () => {
    const futureOnly = FIXTURE.filter((row) => row.scheduledAt === A_NOV_FUTURE);

    expect(computeKpis(futureOnly, NOW)).toEqual({
      total: 5,
      dueCount: 0,
      completionRate: null,
      noShowRate: null,
      cancellationRate: null,
    });
    expect(computeKpis([], NOW).total).toBe(0);
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
    expect(noisy.dueCount).toBe(base.dueCount);
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
  it("returns volume and due-cohort rates per doctor, busiest first", () => {
    expect(byDoctor(FIXTURE, NOW)).toEqual([
      { ...DOCTOR_A, total: 23, dueCount: 16, cancellationRate: 12.5, noShowRate: 18.75 },
      { ...DOCTOR_B, total: 10, dueCount: 9, cancellationRate: 11.11, noShowRate: 11.11 },
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

describe("heatmap", () => {
  it("returns a full weekday × hour grid of non-rejected counts", () => {
    const cells = heatmap(FIXTURE);
    const count = (weekday: string, hourBucket: string) =>
      cells.find((cell) => cell.weekday === weekday && cell.hourBucket === hourBucket)?.count;

    expect(cells).toHaveLength(WEEKDAYS.length * HOUR_BUCKETS.length);
    expect(cells[0]).toEqual({ weekday: "Mon", hourBucket: "00–02", count: 0 });
    expect(count("Mon", "08–10")).toBe(18);
    expect(count("Wed", "14–16")).toBe(7);
    expect(count("Sat", "22–24")).toBe(1);
    expect(count("Mon", "10–12")).toBe(5);
    expect(count("Sun", "00–02")).toBe(1);
    expect(count("Fri", "08–10")).toBe(1);
    expect(cells.reduce((sum, cell) => sum + cell.count, 0)).toBe(33);
  });
});

describe("statusByMonth", () => {
  it("counts each non-rejected status per Manila month", () => {
    expect(statusByMonth(FIXTURE, ["2026-10", "2026-11"])).toEqual([
      {
        month: "2026-10",
        counts: { requested: 1, confirmed: 1, cancelled: 4, checked_in: 1, completed: 15, no_show: 4 },
      },
      {
        month: "2026-11",
        counts: { requested: 2, confirmed: 4, cancelled: 0, checked_in: 0, completed: 1, no_show: 0 },
      },
    ]);
  });
});

describe("ratesBySlot", () => {
  it("returns due-cohort rates for each weekday and hour bucket that has due appointments", () => {
    expect(ratesBySlot(FIXTURE, NOW)).toEqual([
      { weekday: "Mon", hourBucket: "08–10", dueCount: 16, cancellationRate: 12.5, noShowRate: 18.75 },
      { weekday: "Wed", hourBucket: "14–16", dueCount: 7, cancellationRate: 14.29, noShowRate: 14.29 },
      { weekday: "Sat", hourBucket: "22–24", dueCount: 1, cancellationRate: 0, noShowRate: 0 },
      { weekday: "Sun", hourBucket: "00–02", dueCount: 1, cancellationRate: 0, noShowRate: 0 },
    ]);
  });
});
