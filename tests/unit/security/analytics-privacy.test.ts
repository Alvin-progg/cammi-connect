// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ANALYTICS_DATASETS, analyticsDatasetCsv } from "@/lib/analytics/csv";
import type { AnalyticsDatasets } from "@/server/analytics/service";

/**
 * ADM-16 Part C: analytics (page and CSV export) carry no patient
 * identifiers. The repository never selects patient columns, and no export
 * has a patient, email, or phone column.
 */
const PATIENT_FIELD = /patient|email|phone|contact/i;

const EMPTY: AnalyticsDatasets = {
  kpis: {
    total: 0,
    outcomeCount: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    completionRate: null,
    cancellationRate: null,
    noShowRate: null,
    outcomeMonths: null,
    busiestMonth: null,
    peakSlot: null,
    pending: 0,
  },
  monthly: [],
  byDoctor: [],
  heatmap: { cells: [], outsideHours: 0 },
  outcomesByMonth: [],
  ratesByWeekday: [],
};

describe("analytics privacy", () => {
  it("never selects patient columns in the analytics repository", () => {
    const source = readFileSync(join(process.cwd(), "src/server/analytics/repository.ts"), "utf8");
    const selects = [...source.matchAll(/\.select\(\s*"([^"]*)"/g)].map((match) => match[1]);

    expect(selects.length).toBeGreaterThan(0);
    expect(selects.filter((columns) => PATIENT_FIELD.test(columns))).toEqual([]);
  });

  it.each(ANALYTICS_DATASETS)("has no patient column in the %s export", (dataset) => {
    const [header] = analyticsDatasetCsv(dataset, EMPTY).split("\r\n");
    expect(header).not.toMatch(PATIENT_FIELD);
  });
});
