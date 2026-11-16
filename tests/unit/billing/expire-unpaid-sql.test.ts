// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * PAY-08: automatic expiry of unpaid requests and the receipt purge helper
 * (0039). Static checks keep the SQL in step with the spec; the functions are
 * smoke-tested against a local database (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0039_payment_expiry.sql"), "utf8");
const bodies = functionBodies(MIGRATION);
const expire = bodies.find((fn) => fn.name === "cammi_connect_expire_unpaid")?.body ?? "";
const markPurged = bodies.find((fn) => fn.name === "cammi_connect_mark_receipts_purged")?.body ?? "";

describe("payment expiry migration (0039)", () => {
  it("defines cammi_connect_expire_unpaid returning a count", () => {
    expect(expire).not.toBe("");
    expect(MIGRATION).toMatch(/create or replace function public\.cammi_connect_expire_unpaid\(\)\s*returns integer/);
  });

  it("expires only overdue awaiting_payment or rejected payments of pending requests", () => {
    expect(expire).toMatch(/payments\.status in \('awaiting_payment', 'rejected'\)/);
    expect(expire).toMatch(/payments\.deadline_at < now\(\)/);
    expect(expire).toMatch(/appointments\.status = 'requested'/);
    // submitted and hmo_pending never expire on their own.
    expect(expire).not.toMatch(/'submitted'/);
    expect(expire).not.toMatch(/'hmo_pending'/);
  });

  it("is safe to run concurrently: rows locked by others are skipped", () => {
    expect(expire).toMatch(/for update of payments, appointments skip locked/);
  });

  it("cancels as the system with the reason 'Payment not received' and audits it", () => {
    expect(MIGRATION).toMatch(/alter type public\.user_role add value if not exists 'system'/);
    expect(expire).toMatch(/cancelled_by_role = 'system'/);
    expect(expire).toMatch(/'Payment not received'/);
    expect(expire).toMatch(/update public\.appointments[\s\S]*status = 'cancelled'/);
    expect(expire).toMatch(/insert into public\.appointment_audit_logs[\s\S]*'cancelled', 'requested', 'cancelled'/);
  });

  it("never lets a profile take the system role", () => {
    expect(MIGRATION).toMatch(/profiles_role_not_system[\s\S]*check \(role in \('patient', 'doctor', 'admin', 'front_desk'\)\)/);
  });

  it("marks the payment expired with a payment_events row", () => {
    expect(expire).toMatch(/update public\.payments[\s\S]*status = 'expired'/);
    expect(expire).toMatch(/insert into public\.payment_events[\s\S]*'expired'/);
  });

  it("appends Cami's templated Expired message to the patient's latest chat, hidden from the model", () => {
    expect(expire).toMatch(/order by conversations\.updated_at desc/);
    expect(expire).toMatch(/insert into public\.chat_messages/);
    expect(expire).toMatch(/'\{"kind":"payment_update"\}'::jsonb/);
    expect(expire).toMatch(
      /'Your request for ' \|\| v_target \|\| ' on ' \|\| v_when\s*\|\| ' was cancelled because payment wasn''t received in time\. You can book again anytime\.'/,
    );
    // The doctor's name gets "Dr." like doctorDisplayName in src/lib/chat/booking.ts.
    expect(expire).toMatch(/'\^dr\\\.\?\\s'/);
  });

  it("schedules itself every 5 minutes only when pg_cron is installed (D2)", () => {
    expect(MIGRATION).toMatch(/extname = 'pg_cron'/);
    expect(MIGRATION).toMatch(/cron\.schedule\(\s*'cammi-connect-expire-unpaid',\s*'\*\/5 \* \* \* \*'/);
  });

  it("names a system cancellation in the doctor notification", () => {
    expect(MIGRATION).toMatch(/create or replace function public\.cammi_connect_notify_doctor\(\)/);
    expect(MIGRATION).toMatch(/when 'system' then 'the system \(request expired\)'/);
  });

  it("marks purged receipts once (D5): payment rows and history stay", () => {
    expect(MIGRATION).toMatch(/add column if not exists purged_at timestamptz/);
    expect(markPurged).toMatch(/set purged_at = now\(\)/);
    expect(markPurged).toMatch(/purged_at is null/);
    expect(markPurged).not.toMatch(/delete from/i);
  });

  it("locks every function down per ADR-0003", () => {
    expect(MIGRATION).not.toMatch(/create policy/i);
    for (const name of ["cammi_connect_expire_unpaid", "cammi_connect_mark_receipts_purged"]) {
      expect(MIGRATION).toMatch(
        new RegExp(
          `revoke all on function public\\.${name}\\([^)]*\\)\\s*from public, anon, authenticated;\\s*grant execute on function public\\.${name}\\([^)]*\\)\\s*to service_role;`,
        ),
      );
    }
  });
});
