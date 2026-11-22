// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * No-refund policy (0040): the refund trigger, functions, columns, event
 * actions, and setting are gone. Static checks; the migration is smoke-tested
 * against the hosted project (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0040_remove_refunds.sql"), "utf8");
const settingsSave = functionBodies(MIGRATION).find(
  (fn) => fn.name === "cammi_connect_admin_save_settings",
)?.body ?? "";

describe("remove refunds migration (0040)", () => {
  it("drops the D4 trigger and both refund functions", () => {
    expect(MIGRATION).toMatch(/drop trigger if exists appointments_payment_refund on public\.appointments/);
    expect(MIGRATION).toMatch(/drop function if exists public\.cammi_connect_payment_refund_on_cancel\(\)/);
    expect(MIGRATION).toMatch(/drop function if exists public\.cammi_connect_mark_refunded\(uuid, uuid, text\)/);
  });

  it("moves refund_due and refunded payments back to verified", () => {
    expect(MIGRATION).toMatch(/set status = 'verified'\s+where status in \('refund_due', 'refunded'\)/);
  });

  it("removes refund event actions from the append-only history", () => {
    expect(MIGRATION).toMatch(/alter table public\.payment_events disable trigger payment_events_immutable/);
    expect(MIGRATION).toMatch(/delete from public\.payment_events\s+where action in \('refund_due', 'no_refund', 'refunded'\)/);
    expect(MIGRATION).toMatch(/alter table public\.payment_events enable trigger payment_events_immutable/);

    const actionCheck = MIGRATION.match(/add constraint payment_events_action_check check \(([\s\S]*?)\);/)?.[1] ?? "";
    expect(actionCheck).not.toMatch(/refund|no_refund/);
    expect(actionCheck).toContain("'expired'");
  });

  it("drops the refund columns", () => {
    for (const column of ["refund_reference", "refunded_by", "refunded_at"]) {
      expect(MIGRATION).toMatch(new RegExp(`drop column if exists ${column}`));
    }
  });

  it("removes the cutoff setting from the row and from the save function's allow-list", () => {
    expect(MIGRATION).toMatch(/delete from public\.system_settings where key = 'payment\.refund_cutoff_hours'/);
    expect(settingsSave).not.toBe("");
    expect(settingsSave).not.toMatch(/refund_cutoff_hours/);
    expect(settingsSave).toMatch(/'payment\.max_receipts'\s*\n\s*\];/);
  });

  it("is no longer a setting in the app", () => {
    expect(DEFAULT_SETTINGS).not.toHaveProperty("payment.refund_cutoff_hours");
  });
});
