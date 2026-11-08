import { describe, expect, it } from "vitest";

import type { DoctorAnalytics, HeatmapCell, MonthlyOutcomes, WeekdayRates } from "@/lib/analytics/metrics";
import {
  doctorRatesTakeaway,
  doctorTakeaway,
  heatmapTakeaway,
  monthlyTakeaway,
  outcomesTakeaway,
  weekdayRatesTakeaway,
} from "@/lib/analytics/takeaways";

// The reference design's sample year, used to check each sentence.
const MONTHLY = [82, 95, 108, 101, 125, 139, 132, 151, 144, 163, 157, 178].map((total, index) => ({
  month: `2026-${String(index + 1).padStart(2, "0")}`,
  total,
}));

function doctor(doctorName: string, total: number, cancellationRate: number | null, noShowRate: number | null): DoctorAnalytics {
  return {
    doctorId: doctorName,
    doctorName,
    shortName: doctorName,
    total,
    outcomeCount: total,
    cancellationRate,
    noShowRate,
  };
}

describe("monthlyTakeaway", () => {
  it("describes the change from the first to the last month and the dips", () => {
    expect(monthlyTakeaway(MONTHLY)).toBe(
      "Volume more than doubled from January (82) to December (178), with small dips in Apr, Jul, Sep and Nov.",
    );
  });

  it("uses rose or fell without dips when there are none", () => {
    expect(monthlyTakeaway([{ month: "2026-01", total: 10 }, { month: "2026-02", total: 12 }])).toBe(
      "Volume rose from January (10) to February (12).",
    );
    expect(monthlyTakeaway([{ month: "2026-01", total: 12 }, { month: "2026-02", total: 10 }])).toBe(
      "Volume fell from January (12) to February (10).",
    );
  });

  it("ignores empty months at the edges and needs two months with data", () => {
    expect(
      monthlyTakeaway([
        { month: "2026-01", total: 0 },
        { month: "2026-02", total: 5 },
        { month: "2026-03", total: 5 },
        { month: "2026-04", total: 0 },
      ]),
    ).toBe("Volume held steady from February (5) to March (5).");
    expect(monthlyTakeaway([{ month: "2026-01", total: 5 }])).toBeNull();
  });
});

describe("doctorTakeaway", () => {
  it("compares the busiest and the least busy doctor", () => {
    expect(
      doctorTakeaway([doctor("Dr. Carlo Villanueva", 115, null, null), doctor("Dr. Joy Lim", 43, null, null)]),
    ).toBe("Dr. Carlo Villanueva carries 2.7× the load of Dr. Joy Lim.");
  });

  it("says nothing for a single doctor", () => {
    expect(doctorTakeaway([doctor("Dr. A", 5, null, null)])).toBeNull();
  });
});

describe("heatmapTakeaway", () => {
  it("names the busiest and the quietest slot", () => {
    const cells: HeatmapCell[] = [
      { weekday: "Thu", slot: "11 AM–1 PM", count: 29 },
      { weekday: "Fri", slot: "3–5 PM", count: 8 },
      { weekday: "Mon", slot: "9–11 AM", count: 18 },
    ];
    expect(heatmapTakeaway(cells)).toBe("Thursday 11 AM–1 PM peaks at 29; Friday 3–5 PM is quietest (8).");
  });

  it("says nothing when there are no appointments", () => {
    expect(heatmapTakeaway([{ weekday: "Mon", slot: "9–11 AM", count: 0 }])).toBeNull();
  });
});

describe("outcomesTakeaway", () => {
  it("tracks completed visits and the share of cancellations and no-shows", () => {
    const outcomes: MonthlyOutcomes[] = [
      { month: "2026-01", completed: 65, cancelled: 10, noShow: 7 },
      { month: "2026-02", completed: 76, cancelled: 11, noShow: 8 },
      { month: "2026-06", completed: 113, cancelled: 15, noShow: 11 },
    ];
    expect(outcomesTakeaway(outcomes)).toBe(
      "Completed visits went from 65 to 113; cancellations and no-shows were 20% of outcomes.",
    );
  });

  it("states only the share for one month and nothing when empty", () => {
    expect(outcomesTakeaway([{ month: "2026-01", completed: 3, cancelled: 1, noShow: 0 }])).toBe(
      "Cancellations and no-shows were 25% of outcomes.",
    );
    expect(outcomesTakeaway([])).toBeNull();
  });
});

describe("weekdayRatesTakeaway", () => {
  it("names the weekday with the most cancellations and no-shows", () => {
    const rates: WeekdayRates[] = [
      { weekday: "Mon", outcomeCount: 50, cancellationRate: 8, noShowRate: 6 },
      { weekday: "Fri", outcomeCount: 50, cancellationRate: 15, noShowRate: 11 },
    ];
    expect(weekdayRatesTakeaway(rates)).toBe("Friday is highest: 15% cancelled, 11% no-show.");
    expect(weekdayRatesTakeaway([])).toBeNull();
  });
});

describe("doctorRatesTakeaway", () => {
  it("joins the clauses when one doctor leads both rates and another trails both", () => {
    expect(
      doctorRatesTakeaway([
        doctor("Dr. Grace Lim", 50, 14, 10),
        doctor("Dr. Carlo Villanueva", 80, 6, 4),
        doctor("Dr. Ana Reyes", 60, 8, 5),
      ]),
    ).toBe("Dr. Grace Lim's patients cancel most (14%) and miss most (10%); Dr. Carlo Villanueva's least (6% and 4%).");
  });

  it("states each rate's leader separately when they differ", () => {
    expect(doctorRatesTakeaway([doctor("Dr. A", 50, 14, 4), doctor("Dr. B", 50, 6, 10)])).toBe(
      "Dr. A's patients cancel most (14%); Dr. B's miss most (10%).",
    );
  });

  it("needs two doctors with outcomes", () => {
    expect(doctorRatesTakeaway([doctor("Dr. A", 50, 14, 4), doctor("Dr. B", 5, null, null)])).toBeNull();
  });
});
