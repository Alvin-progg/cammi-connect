// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * AI-APT-002: routing hints and first-contact settings live partly in SQL
 * (0032). These static checks keep the migration in step with the TS schema;
 * the functions themselves are smoke-tested against a local database.
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0032_specialty_routing_hints.sql"), "utf8");
const bodies = functionBodies(MIGRATION);
const saveBody = bodies.find(({ name }) => name === "cammi_connect_admin_save_specialty")?.body ?? "";
const settingsBody =
  bodies.find(({ name }) => name === "cammi_connect_admin_save_settings")?.body ?? "";

describe("specialty routing hints (0032)", () => {
  it("adds routing_hints with a 1,000-character limit", () => {
    expect(MIGRATION).toMatch(/add column if not exists routing_hints text/);
    expect(MIGRATION).toMatch(/char_length\(routing_hints\) <= 1000/);
  });

  it("stores the hints and puts them in the audit payload", () => {
    expect(saveBody).toMatch(/routing_hints = v_routing_hints/);
    expect(saveBody).toMatch(/'routing_hints', v_previous\.routing_hints/);
    expect(saveBody).toMatch(/'routing_hints', v_routing_hints/);
  });

  it("replaces the old four-argument save function and grants only service_role", () => {
    expect(MIGRATION).toMatch(
      /drop function if exists public\.cammi_connect_admin_save_specialty\(uuid, uuid, text, text\)/,
    );
    expect(MIGRATION).toMatch(
      /grant execute on function public\.cammi_connect_admin_save_specialty\(uuid, uuid, text, text, text\)\s+to service_role/,
    );
  });

  it("lets admins save every allow-listed setting, including the first-contact specialties", () => {
    // Keys from later migrations (PAY-01 payment.*/billing.*, 0033) are checked
    // against the newest save function in tests/unit/billing/price-catalogue-sql.test.ts.
    const keysAt0032 = Object.keys(DEFAULT_SETTINGS).filter(
      (key) => !key.startsWith("payment.") && !key.startsWith("billing."),
    );
    for (const key of keysAt0032) {
      expect(settingsBody).toContain(`'${key}'`);
    }
  });
});
