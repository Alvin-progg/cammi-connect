import { describe, expect, it } from "vitest";

import { analyticsDatasetCsv, isAnalyticsDataset, toCsv } from "@/lib/analytics/csv";
import { DAYTIME_SLOTS } from "@/lib/analytics/metrics";
import type { AnalyticsDatasets } from "@/server/analytics/service";

const CLINIC_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

const DATASETS: AnalyticsDatasets = {
  kpis: {
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
    pending: 4,
  },
  monthly: [
    { month: "2026-10", total: 26 },
    { month: "2026-11", total: 7 },
  ],
  byDoctor: [
    {
      doctorId: "a",
      doctorName: "Dr. Alpha, Jr.",
      shortName: "Jr.",
      total: 23,
      outcomeCount: 16,
      cancellationRate: 18.75,
      noShowRate: 18.75,
    },
    {
      doctorId: "b",
      doctorName: "=HYPERLINK(\"x\")",
      shortName: "x",
      total: 0,
      outcomeCount: 0,
      cancellationRate: null,
      noShowRate: null,
    },
  ],
  heatmap: {
    cells: CLINIC_DAYS.flatMap((weekday) =>
      DAYTIME_SLOTS.map((slot) => ({ weekday, slot, count: weekday === "Mon" && slot === "9–11 AM" ? 23 : 0 })),
    ),
    outsideHours: 2,
  },
  outcomesByMonth: [{ month: "2026-10", completed: 15, cancelled: 4, noShow: 4 }],
  ratesByWeekday: [{ weekday: "Wed", outcomeCount: 6, cancellationRate: 16.67, noShowRate: 16.67 }],
};

describe("toCsv", () => {
  it("writes a header row and CRLF-separated rows", () => {
    expect(toCsv(["a", "b"], [[1, "x"], [2, "y"]])).toBe("a,b\r\n1,x\r\n2,y\r\n");
  });

  it("quotes commas, quotes, and newlines", () => {
    expect(toCsv(["name"], [["Dr. Alpha, Jr."], ['Say "hi"'], ["two\nlines"]])).toBe(
      'name\r\n"Dr. Alpha, Jr."\r\n"Say ""hi"""\r\n"two\nlines"\r\n',
    );
  });

  it("leaves null cells blank", () => {
    expect(toCsv(["rate"], [[null]])).toBe("rate\r\n\r\n");
  });

  it("neutralises text that a spreadsheet would run as a formula", () => {
    expect(toCsv(["v"], [["=1+1"], ["+1"], ["-1"], ["@SUM(A1)"], ["\tx"]])).toBe(
      "v\r\n'=1+1\r\n'+1\r\n'-1\r\n'@SUM(A1)\r\n'\tx\r\n",
    );
  });

  it("does not prefix negative numbers", () => {
    expect(toCsv(["v"], [[-1.5]])).toBe("v\r\n-1.5\r\n");
  });
});

describe("isAnalyticsDataset", () => {
  it("accepts only the six datasets", () => {
    for (const dataset of ["kpis", "monthly", "doctor", "heatmap", "outcomes", "weekday"]) {
      expect(isAnalyticsDataset(dataset)).toBe(true);
    }
    expect(isAnalyticsDataset("patients")).toBe(false);
  });
});

describe("analyticsDatasetCsv", () => {
  it("exports the KPIs as metric/value rows", () => {
    expect(analyticsDatasetCsv("kpis", DATASETS)).toBe(
      [
        "metric,value",
        "total_appointments,33",
        "outcome_cohort,24",
        "completed,16",
        "cancelled,4",
        "no_show,4",
        "completion_rate_pct,66.67",
        "cancellation_rate_pct,16.67",
        "no_show_rate_pct,16.67",
        "outcome_months,2026-10 to 2026-11",
        "busiest_month,2026-10",
        "busiest_month_total,26",
        "peak_slot,Mon 9–11 AM",
        "peak_slot_total,23",
        "pending_now,4",
        "",
      ].join("\r\n"),
    );
  });

  it("exports monthly volume", () => {
    expect(analyticsDatasetCsv("monthly", DATASETS)).toBe("month,total_appointments\r\n2026-10,26\r\n2026-11,7\r\n");
  });

  it("exports doctors with escaped, formula-safe names and blank null rates", () => {
    expect(analyticsDatasetCsv("doctor", DATASETS)).toBe(
      [
        "doctor,total_appointments,outcome_cohort,cancellation_rate_pct,no_show_rate_pct",
        '"Dr. Alpha, Jr.",23,16,18.75,18.75',
        `"'=HYPERLINK(""x"")",0,0,,`,
        "",
      ].join("\r\n"),
    );
  });

  it("exports the heatmap grid and the outside-hours count", () => {
    const lines = analyticsDatasetCsv("heatmap", DATASETS).trimEnd().split("\r\n");

    expect(lines[0]).toBe("weekday,slot_manila,total_appointments");
    expect(lines).toHaveLength(1 + CLINIC_DAYS.length * DAYTIME_SLOTS.length + 1);
    expect(lines).toContain("Mon,9–11 AM,23");
    expect(lines[lines.length - 1]).toBe("All,Outside 9 AM–5 PM,2");
  });

  it("exports outcomes by month", () => {
    expect(analyticsDatasetCsv("outcomes", DATASETS)).toBe("month,completed,cancelled,no_show\r\n2026-10,15,4,4\r\n");
  });

  it("exports weekday rates", () => {
    expect(analyticsDatasetCsv("weekday", DATASETS)).toBe(
      "weekday,outcome_cohort,cancellation_rate_pct,no_show_rate_pct\r\nWed,6,16.67,16.67\r\n",
    );
  });
});
