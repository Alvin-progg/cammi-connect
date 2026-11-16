import { describe, expect, it } from "vitest";

import {
  doctorLoadInterpretation,
  doctorRatesInterpretation,
  heatmapInterpretation,
  interpretAnalytics,
  monthlyInterpretation,
  outcomesInterpretation,
  summarize,
  weekdayRatesInterpretation,
  type Interpretation,
  type Interpretations,
} from "@/lib/analytics/interpretation";
import {
  DAYTIME_SLOTS,
  WEEKDAYS,
  type DoctorAnalytics,
  type HeatmapCell,
  type MonthlyOutcomes,
  type MonthlyVolume,
  type WeekdayRates,
} from "@/lib/analytics/metrics";

const LONG_NAME = "Dr. Maria Concepcion Dela Cruz-Santos";

function months(...totals: number[]): MonthlyVolume[] {
  return totals.map((total, index) => ({ month: `2026-${String(index + 8).padStart(2, "0")}`, total }));
}

function doctor(doctorName: string, total: number, outcomeCount = 0, missedPercent: number | null = null): DoctorAnalytics {
  return {
    doctorId: doctorName,
    doctorName,
    shortName: doctorName,
    total,
    outcomeCount,
    cancellationRate: missedPercent,
    noShowRate: missedPercent === null ? null : 0,
  };
}

/** Weekday × slot cells, Mon–Fri, all `base` except the first cell (Monday 9–11 AM) at `peak`. */
function cells(base: number, peak: number): HeatmapCell[] {
  return WEEKDAYS.slice(0, 5).flatMap((weekday, dayIndex) =>
    DAYTIME_SLOTS.map((slot, slotIndex) => ({ weekday, slot, count: dayIndex === 0 && slotIndex === 0 ? peak : base })),
  );
}

function outcomes(completed: number, cancelled: number, noShow: number): MonthlyOutcomes[] {
  return [{ month: "2026-10", completed, cancelled, noShow }];
}

/** Weekday rates with `outcomeCount` visits each and `missed[i]` of them missed (as cancellations). */
function weekdays(outcomeCount: number, missed: number[]): WeekdayRates[] {
  return missed.map((count, index) => ({
    weekday: WEEKDAYS[index],
    outcomeCount,
    cancellationRate: Math.round((count / outcomeCount) * 10_000) / 100,
    noShowRate: 0,
  }));
}

function words(text: string): number {
  return text.trim().split(/\s+/).length;
}

describe("monthlyInterpretation", () => {
  it("says demand is growing at or above 1.2× the first month", () => {
    expect(monthlyInterpretation(months(10, 12))).toEqual({
      severity: "watch",
      text: "Demand is growing; watch doctor capacity.",
      point: "demand is growing; watch doctor capacity.",
    });
    expect(monthlyInterpretation(months(40, 60, 85))?.text).toBe("Demand is growing; watch doctor capacity.");
  });

  it("says demand is falling at or below 0.8× the first month", () => {
    expect(monthlyInterpretation(months(20, 16))).toEqual({
      severity: "alert",
      text: "Demand is falling compared with August.",
      point: "demand is falling compared with August.",
    });
  });

  it("says demand is steady between the bands", () => {
    expect(monthlyInterpretation(months(10, 11.9))?.text).toBe("Demand is steady.");
    expect(monthlyInterpretation(months(100, 81))).toMatchObject({ severity: "ok", text: "Demand is steady." });
  });

  it("ignores empty edge months, like the takeaway", () => {
    expect(monthlyInterpretation(months(0, 10, 15, 0))?.text).toBe("Demand is growing; watch doctor capacity.");
  });

  it("needs 2 months with appointments and at least 20 in total", () => {
    expect(monthlyInterpretation(months(9, 10))).toBeNull();
    expect(monthlyInterpretation(months(25))).toBeNull();
    expect(monthlyInterpretation(months(25, 0))).toBeNull();
    expect(monthlyInterpretation(months(10, 10))).not.toBeNull();
  });
});

describe("doctorLoadInterpretation", () => {
  it("calls workload uneven at 2× and names the busiest doctor", () => {
    expect(doctorLoadInterpretation([doctor("Dr. Santos", 10), doctor("Dr. Reyes", 5)])).toEqual({
      severity: "alert",
      text: "Workload is uneven; Dr. Santos is carrying the most.",
      point: "workload is uneven; Dr. Santos carries the most.",
    });
  });

  it("calls workload somewhat uneven from 1.3× to under 2×", () => {
    expect(doctorLoadInterpretation([doctor("A", 13), doctor("B", 10)])).toMatchObject({
      severity: "watch",
      text: "Workload is somewhat uneven.",
    });
    expect(doctorLoadInterpretation([doctor("A", 19), doctor("B", 10)])?.severity).toBe("watch");
  });

  it("calls workload balanced under 1.3×", () => {
    expect(doctorLoadInterpretation([doctor("A", 12), doctor("B", 10)])).toMatchObject({
      severity: "ok",
      text: "Workload is balanced across doctors.",
    });
  });

  it("compares only doctors with at least 5 appointments and needs 2 of them", () => {
    expect(doctorLoadInterpretation([doctor("A", 10), doctor("B", 10), doctor("C", 1)])?.text).toBe(
      "Workload is balanced across doctors.",
    );
    expect(doctorLoadInterpretation([doctor("A", 50), doctor("B", 4)])).toBeNull();
    expect(doctorLoadInterpretation([doctor("A", 50)])).toBeNull();
  });
});

describe("heatmapInterpretation", () => {
  it("names the clear rush hour when the peak is at least 2× the average cell", () => {
    // 20 cells, total 40: average 2, peak 4.
    const peaked = cells(2, 4).map((cell, index) => (index === 1 ? { ...cell, count: 0 } : cell));
    expect(heatmapInterpretation(peaked)).toEqual({
      severity: "watch",
      text: "Monday 9–11 AM is the clear rush hour.",
      point: "Monday 9–11 AM is the clear rush hour.",
    });
  });

  it("says visits are spread evenly below 2× the average", () => {
    expect(heatmapInterpretation(cells(2, 3))).toMatchObject({
      severity: "ok",
      text: "Visits are spread fairly evenly through the week.",
    });
  });

  it("needs at least 30 appointments", () => {
    expect(heatmapInterpretation(cells(1, 10))).toBeNull(); // 29
    expect(heatmapInterpretation(cells(1, 11))).not.toBeNull(); // 30
    expect(heatmapInterpretation([])).toBeNull();
  });
});

describe("outcomesInterpretation", () => {
  it("calls 20% or more missed high, as about 1 in N", () => {
    expect(outcomesInterpretation(outcomes(16, 2, 2))).toEqual({
      severity: "alert",
      text: "High: about 1 in 5 visits is lost.",
      point: "about 1 in 5 visits is lost.",
    });
    expect(outcomesInterpretation(outcomes(15, 3, 2))?.text).toBe("High: about 1 in 4 visits is lost.");
  });

  it("calls 10% to under 20% moderate", () => {
    expect(outcomesInterpretation(outcomes(27, 2, 1))).toMatchObject({
      severity: "watch",
      text: "Moderate share of visits lost.",
    });
    expect(outcomesInterpretation(outcomes(21, 4, 1))?.severity).toBe("watch"); // 19.2%
  });

  it("calls under 10% low", () => {
    expect(outcomesInterpretation(outcomes(29, 2, 1))).toMatchObject({
      severity: "ok",
      text: "Low: most patients show up.",
    });
  });

  it("needs at least 20 finished visits", () => {
    expect(outcomesInterpretation(outcomes(15, 2, 2))).toBeNull();
    expect(outcomesInterpretation([])).toBeNull();
  });
});

describe("weekdayRatesInterpretation", () => {
  it("names the weekday at 1.5× the average missed rate", () => {
    // 10 visits a day; missed 3,2,1,2,2 → average 20%, Monday 30%.
    expect(weekdayRatesInterpretation(weekdays(10, [3, 2, 1, 2, 2]))).toEqual({
      severity: "alert",
      text: "Mondays lose the most visits; reminders matter most then.",
      point: "Mondays lose the most visits; reminders matter most then.",
    });
  });

  it("says no weekday stands out below 1.5×, or when nothing was missed", () => {
    expect(weekdayRatesInterpretation(weekdays(10, [3, 2, 2, 2, 2]))).toMatchObject({
      severity: "ok",
      text: "No weekday stands out for missed visits.",
    });
    expect(weekdayRatesInterpretation(weekdays(10, [0, 0, 0]))?.severity).toBe("ok");
  });

  it("needs at least 20 finished visits", () => {
    expect(weekdayRatesInterpretation(weekdays(19, [10]))).toBeNull();
    expect(weekdayRatesInterpretation(weekdays(10, [5, 0]))).not.toBeNull();
  });
});

describe("doctorRatesInterpretation", () => {
  it("names the doctor at 1.5× the average missed rate", () => {
    // 10 visits each; 30% vs 10% → average 20%.
    expect(doctorRatesInterpretation([doctor("Dr. Santos", 10, 10, 30), doctor("Dr. Reyes", 10, 10, 10)])).toEqual({
      severity: "alert",
      text: "Dr. Santos's patients miss visits most often.",
      point: "Dr. Santos's patients miss visits most often.",
    });
  });

  it("says missed visits are similar below 1.5×", () => {
    expect(doctorRatesInterpretation([doctor("A", 10, 10, 25), doctor("B", 10, 10, 15)])).toMatchObject({
      severity: "ok",
      text: "Missed visits are similar across doctors.",
    });
  });

  it("ignores doctors with no finished visits and needs at least 20 in total", () => {
    expect(doctorRatesInterpretation([doctor("A", 10, 10, 30), doctor("B", 9, 9, 10)])).toBeNull();
    expect(
      doctorRatesInterpretation([doctor("A", 10, 10, 30), doctor("B", 10, 10, 10), doctor("C", 4, 0, null)])?.severity,
    ).toBe("alert");
  });
});

const ALERT: Interpretation = { severity: "alert", text: "Alert text.", point: "alert point." };
const WATCH: Interpretation = { severity: "watch", text: "Watch text.", point: "watch point." };
const OK: Interpretation = { severity: "ok", text: "Ok text.", point: "ok point." };

function interpretations(values: Partial<Interpretations>): Interpretations {
  return {
    "monthly-volume": null,
    "doctor-volume": null,
    "peak-times": null,
    outcomes: null,
    "weekday-rates": null,
    "doctor-rates": null,
    ...values,
  };
}

describe("summarize", () => {
  it("puts alerts before watch items, keeps chart order, and stops at 3", () => {
    const summary = summarize(
      interpretations({
        "monthly-volume": WATCH,
        "doctor-volume": ALERT,
        "peak-times": WATCH,
        outcomes: ALERT,
        "weekday-rates": OK,
      }),
    );
    expect(summary).toEqual({
      points: [
        { chartId: "doctor-volume", severity: "alert", text: "Doctors: alert point." },
        { chartId: "outcomes", severity: "alert", text: "Outcomes: alert point." },
        { chartId: "monthly-volume", severity: "watch", text: "Volume: watch point." },
      ],
    });
  });

  it("shows the steady line when nothing is alert or watch", () => {
    expect(summarize(interpretations({ outcomes: OK }))).toEqual({
      message: "Everything looks steady for this period.",
    });
  });

  it("shows the not-enough line when no chart has enough data", () => {
    expect(summarize(interpretations({}))).toEqual({ message: "Not enough data yet to interpret this period." });
  });
});

/** Every template, with the longest realistic doctor name and month. */
function everyInterpretation(): Interpretation[] {
  const all = [
    monthlyInterpretation(months(10, 12)),
    monthlyInterpretation(months(20, 16)),
    monthlyInterpretation([{ month: "2026-09", total: 20 }, { month: "2026-10", total: 10 }]), // September
    monthlyInterpretation(months(10, 10)),
    doctorLoadInterpretation([doctor(LONG_NAME, 10), doctor("B", 5)]),
    doctorLoadInterpretation([doctor("A", 15), doctor("B", 10)]),
    doctorLoadInterpretation([doctor("A", 10), doctor("B", 10)]),
    heatmapInterpretation(
      WEEKDAYS.slice(0, 5).flatMap((weekday) =>
        DAYTIME_SLOTS.map((slot) => ({ weekday, slot, count: weekday === "Wed" && slot === "11 AM–1 PM" ? 40 : 1 })),
      ),
    ),
    heatmapInterpretation(cells(2, 2)),
    outcomesInterpretation(outcomes(10, 5, 5)),
    outcomesInterpretation(outcomes(27, 2, 1)),
    outcomesInterpretation(outcomes(29, 1, 0)),
    weekdayRatesInterpretation(weekdays(10, [1, 1, 5, 1, 1])),
    weekdayRatesInterpretation(weekdays(10, [1, 1, 1])),
    doctorRatesInterpretation([doctor(LONG_NAME, 10, 10, 30), doctor("B", 10, 10, 10)]),
    doctorRatesInterpretation([doctor("A", 10, 10, 10), doctor("B", 10, 10, 10)]),
  ];
  return all.map((interpretation) => {
    if (!interpretation) throw new Error("fixture did not meet its minimum");
    return interpretation;
  });
}

describe("interpretation templates", () => {
  it("cover every template, each at most 12 words", () => {
    const all = everyInterpretation();
    expect(new Set(all.map((item) => item.text)).size).toBe(16);
    for (const { text } of all) expect(words(text), text).toBeLessThanOrEqual(12);
  });

  it("make summary points of at most 15 words", () => {
    const ids = Object.keys(interpretations({})) as (keyof Interpretations)[];
    for (const item of everyInterpretation()) {
      for (const chartId of ids) {
        const summary = summarize(interpretations({ [chartId]: { ...item, severity: "alert" } }));
        if (!("points" in summary)) throw new Error("expected points");
        for (const point of summary.points) expect(words(point.text), point.text).toBeLessThanOrEqual(15);
      }
    }
  });

  it("never state a cause", () => {
    for (const { text, point } of everyInterpretation()) {
      expect(`${text} ${point}`).not.toMatch(/\bbecause\b|\bdue to\b|\bcaused?\b|\bsince\b/i);
    }
  });
});

describe("interpretAnalytics", () => {
  const datasets = {
    monthly: months(10, 12),
    byDoctor: [doctor("Dr. Santos", 10, 10, 30), doctor("Dr. Reyes", 5, 10, 10)],
    heatmap: { cells: cells(2, 3), outsideHours: 0 },
    outcomesByMonth: outcomes(15, 3, 2),
    ratesByWeekday: weekdays(10, [3, 2, 1, 2, 2]),
  };

  it("interprets every chart from its own dataset", () => {
    const result = interpretAnalytics(datasets);
    expect(result["monthly-volume"]?.severity).toBe("watch");
    expect(result["doctor-volume"]?.severity).toBe("alert");
    expect(result["peak-times"]?.severity).toBe("ok");
    expect(result.outcomes?.severity).toBe("alert");
    expect(result["weekday-rates"]?.severity).toBe("alert");
    expect(result["doctor-rates"]?.severity).toBe("alert");
  });

  it("gives the same words for the same data", () => {
    expect(interpretAnalytics(datasets)).toEqual(interpretAnalytics(structuredClone(datasets)));
    expect(summarize(interpretAnalytics(datasets))).toEqual(summarize(interpretAnalytics(datasets)));
  });
});
