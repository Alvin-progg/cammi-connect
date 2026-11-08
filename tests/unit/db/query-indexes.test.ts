// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * Indexes for the hot list/filter queries (front desk queue and day schedule,
 * admin monitoring, analytics, dashboard feeds, audit log filters). Static
 * check: without a local database we can only assert each migration creates
 * them on the right columns.
 */
const REQUIRED_INDEXES: Record<string, string> = {
  appointments_scheduled_at_idx: "public.appointments (scheduled_at)",
  appointments_status_created_at_idx: "public.appointments (status, created_at)",
  appointments_confirmed_at_idx: "public.appointments (confirmed_at desc)",
  appointments_status_updated_at_idx: "public.appointments (status, updated_at desc)",
  appointment_audit_logs_created_at_idx: "public.appointment_audit_logs (created_at desc)",
  audit_logs_actor_created_at_idx: "public.audit_logs (actor_profile_id, created_at desc)",
  audit_logs_action_pattern_idx: "public.audit_logs (action text_pattern_ops)",
};

const allMigrations = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
  .replace(/\s+/g, " ");

describe("query indexes", () => {
  it.each(Object.entries(REQUIRED_INDEXES))("creates %s on %s", (name, target) => {
    expect(allMigrations).toContain(`create index if not exists ${name} on ${target}`);
  });
});
