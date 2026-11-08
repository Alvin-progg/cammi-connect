// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { migrationFunctionBodies } from "../../helpers/sql";

/**
 * ADM-16 Part B: each audit event the spec requires (§16) must be written
 * somewhere. Without a local database this is a static check, not an
 * integration test: the action string has to appear either in a migration
 * function body that inserts into audit_logs, or as `action: "<event>"` in
 * server code that calls recordAdminAudit. The db/README.md smoke tests
 * cover the rows themselves.
 */
const REQUIRED_EVENTS: Record<string, string[]> = {
  "user create": ["user.create"],
  "role change": ["user.role_change"],
  "user activate/deactivate": ["user.activate", "user.deactivate"],
  "doctor change": ["doctor.create", "doctor.update", "doctor.activate", "doctor.deactivate"],
  "department change": ["department.create", "department.update", "department.deactivate"],
  "specialty change": ["specialty.create", "specialty.update", "specialty.deactivate"],
  "schedule create/update": ["schedule.create", "schedule.update"],
  "schedule exception": ["schedule_exception.create", "schedule_exception.delete"],
  "service change": ["service.create", "service.update", "service.deactivate"],
  "appointment config change": ["settings.update"],
  "knowledge publish/archive": ["knowledge.publish", "knowledge.archive"],
  "audit export": ["audit.export"],
};

const AUDIT_LOG_INSERT = /insert\s+into\s+public\.audit_logs\b/i;

const auditedSqlBodies = migrationFunctionBodies()
  .filter(({ body }) => AUDIT_LOG_INSERT.test(body))
  .map(({ body }) => body);

const SERVER_DIRS = ["src/server", "src/app/api"].map((dir) => join(process.cwd(), dir));

const serverSources = SERVER_DIRS.flatMap((dir) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts"))
    .map((file) => readFileSync(join(dir, file), "utf8")),
).filter((source) => source.includes("recordAdminAudit"));

function isWritten(action: string): boolean {
  return (
    auditedSqlBodies.some((body) => body.includes(`'${action}'`)) ||
    serverSources.some((source) => source.includes(`action: "${action}"`))
  );
}

describe("required audit events (spec §16)", () => {
  it("finds the audited SQL functions and server writers", () => {
    // Guards the scan itself: ADM-01..15 each add audited functions.
    expect(auditedSqlBodies.length).toBeGreaterThanOrEqual(20);
    expect(serverSources.length).toBeGreaterThanOrEqual(2);
  });

  it.each(Object.entries(REQUIRED_EVENTS))("writes %s", (_event, actions) => {
    expect(actions.filter((action) => !isWritten(action))).toEqual([]);
  });
});
