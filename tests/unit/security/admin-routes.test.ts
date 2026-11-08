// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ADM-16 Part C route inventory. Every admin page and admin API handler must
 * check the admin session itself (getAdminSession, directly or through the
 * shared AdminPlaceholderPage). The proxy only redirects optimistically, so a
 * route without its own check would be open to any signed-in user.
 */
const ROOT = process.cwd();
const ROUTE_DIRS = ["src/app/admin", "src/app/api/admin"];
const ROUTE_FILE = /(^|\/)(page|route)\.tsx?$/;
const ADMIN_GUARD = /\bgetAdminSession\(|<AdminPlaceholderPage\b/;

const routes = ROUTE_DIRS.flatMap((dir) =>
  readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => ROUTE_FILE.test(file))
    .map((file) => join(ROOT, dir, file)),
);

describe("admin route inventory", () => {
  it("finds every admin page and API route", () => {
    // 30 routes existed before ADM-16 and it adds 2; guards the walker itself.
    expect(routes.length).toBeGreaterThanOrEqual(32);
  });

  it("checks the admin session in every admin page and API route", () => {
    const unguarded = routes
      .filter((file) => !ADMIN_GUARD.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file));

    expect(unguarded).toEqual([]);
  });

  it("checks the admin session inside the shared placeholder page", () => {
    const placeholder = readFileSync(join(ROOT, "src/app/admin/_shared/placeholder-page.tsx"), "utf8");
    expect(placeholder).toMatch(/\bgetAdminSession\(/);
  });
});
