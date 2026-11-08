// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Admin reference data (departments, specialties, doctors, services,
 * requirements, schedules, knowledge documents) is cached across requests
 * under one tag until a write clears it. Two static guards:
 *  - every action file that writes that data clears the tag, so a page never
 *    keeps showing data an admin or doctor just changed;
 *  - no module that reads appointments, notifications, chat, or analytics
 *    caches across requests, so patient data never sits in the server cache.
 */
const SERVER_DIR = join(process.cwd(), "src/server");

const REFERENCE_WRITERS = [
  "departments/actions.ts",
  "specialties/actions.ts",
  "doctors/actions.ts",
  "users/actions.ts",
  "profiles/actions.ts",
  "services/actions.ts",
  "requirements/actions.ts",
  "schedules/actions.ts",
  "knowledge/actions.ts",
  "settings/actions.ts",
];

const UNCACHED_DIRS = [
  "appointments",
  "appointments-monitoring",
  "front-desk",
  "notifications",
  "chat",
  "analytics",
  "audit",
  "auth",
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("reference data cache", () => {
  it.each(REFERENCE_WRITERS)("%s clears the reference cache tag", (file) => {
    const source = readFileSync(join(SERVER_DIR, file), "utf8");
    expect(source).toContain("updateTag(REFERENCE_CACHE_TAG)");
  });

  it.each(UNCACHED_DIRS)("src/server/%s never caches across requests", (dir) => {
    const offenders = filesUnder(join(SERVER_DIR, dir))
      .filter((file) => /["']use cache/.test(readFileSync(file, "utf8")))
      .map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});
