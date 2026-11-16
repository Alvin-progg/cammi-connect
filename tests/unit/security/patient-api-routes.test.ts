// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Patient API routes (/api/v1) resolve the patient session themselves. The
 * proxy does not run on /api, so a route without this check would be open.
 */
const API_DIR = join(process.cwd(), "src/app/api/v1");
const routes = readdirSync(API_DIR, { recursive: true, encoding: "utf8" }).filter((file) =>
  /(^|\/)route\.ts$/.test(file),
);

describe("patient API route inventory", () => {
  it("finds the chat and receipt routes", () => {
    expect(routes).toEqual(
      expect.arrayContaining([join("chat", "route.ts"), join("payments", "[id]", "receipt", "route.ts")]),
    );
  });

  it("resolves the patient session in every route", () => {
    const unguarded = routes.filter(
      (file) => !/\bresolvePatient: resolvePatientForApi\b/.test(readFileSync(join(API_DIR, file), "utf8")),
    );
    expect(unguarded).toEqual([]);
  });
});
