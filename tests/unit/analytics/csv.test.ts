import { describe, expect, it } from "vitest";

import { analyticsDatasetCsv, isAnalyticsDataset, toCsv } from "@/lib/analytics/csv";
import { HOUR_BUCKETS, WEEKDAYS } from "@/lib/analytics/metrics";
import type { AnalyticsDatasets } from "@/server/analytics/service";

const DATASETS: AnalyticsDatasets = {
  kpis: {
    total: 33,
    dueCount: 25,
    completionRate: 64,
    noShowRate: 16,
    cancellationRate: 12,
    pending: 4,
  },
  monthly: [
    { month: "2026-10", total: 26 },
    { month: "2026-11", total: 7 },
  ],
  byDoctor: [
    { doctorId: "a", doctorName: "Dr. Alpha, Jr.", total: 23, dueCount: 16, cancellationRate: 12.5, noShowRate: 18.75 },
    { doctorId: "b", doctorName: "=HYPERLINK(\"x\")", total: 0, dueCount: 0, cancellationRate: null, noShowRate: null },
  ],
  heatmap: WEEKDAYS.flatMap((weekday) =>
    HOUR_BUCKETS.map((hourBucket) => ({
      weekday,
      hourBucket,
      count: weekday === "Mon" && hourBucket === "08–10" ? 18 : 0,
    })),
  ),
  statusByMonth: [
    {
      month: "2026-10",
      counts: { requested: 1, confirmed: 1, cancelled: 4, checked_in: 1, completed: 15, no_show: 4 },
    },
  ],
  ratesBySlot: [{ weekday: "Wed", hourBucket: "14–16", dueCount: 7, cancellationRate: 14.29, noShowRate: 14.29 }],
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
    for (const dataset of ["kpis", "monthly", "doctor", "heatmap", "status", "slots"]) {
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
        "due_cohort,25",
        "completion_rate_pct,64",
        "no_show_rate_pct,16",
        "cancellation_rate_pct,12",
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
        "doctor,total_appointments,due_cohort,cancellation_rate_pct,no_show_rate_pct",
        '"Dr. Alpha, Jr.",23,16,12.5,18.75',
        `"'=HYPERLINK(""x"")",0,0,,`,
        "",
      ].join("\r\n"),
    );
  });

  it("exports the full heatmap grid", () => {
    const lines = analyticsDatasetCsv("heatmap", DATASETS).trimEnd().split("\r\n");

    expect(lines[0]).toBe("weekday,hour_bucket_manila,total_appointments");
    expect(lines).toHaveLength(1 + WEEKDAYS.length * HOUR_BUCKETS.length);
    expect(lines).toContain("Mon,08–10,18");
  });

  it("exports status counts by month", () => {
    expect(analyticsDatasetCsv("status", DATASETS)).toBe(
      "month,requested,confirmed,cancelled,checked_in,completed,no_show\r\n2026-10,1,1,4,1,15,4\r\n",
    );
  });

  it("exports slot rates", () => {
    expect(analyticsDatasetCsv("slots", DATASETS)).toBe(
      "weekday,hour_bucket_manila,due_cohort,cancellation_rate_pct,no_show_rate_pct\r\nWed,14–16,7,14.29,14.29\r\n",
    );
  });
});
