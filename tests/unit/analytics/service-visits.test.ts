// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * PAY-07 decision: analytics (ADM-10/11/12) are doctor-consultation metrics,
 * so service visits (lab, imaging, packages; no doctor) are left out of every
 * appointment read the metric layer makes. Revenue numbers come with PAY-08.
 */
describe("analytics and service visits", () => {
  it("filters every appointments read to consultations", () => {
    const source = readFileSync(join(process.cwd(), "src/server/analytics/repository.ts"), "utf8");
    const reads = source.match(/\.from\("appointments"\)/g) ?? [];
    const filters = source.match(/\.eq\("kind", "consultation"\)/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    expect(filters.length).toBe(reads.length);
  });
});
