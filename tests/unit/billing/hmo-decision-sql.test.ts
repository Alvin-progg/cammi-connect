// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * PAY-06: HMO approve/deny (0037). Static checks keep the SQL in step with
 * the TS rules; the function is smoke-tested against a local database
 * (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0037_hmo_decisions.sql"), "utf8");
const decide = functionBodies(MIGRATION).find((fn) => fn.name === "cammi_connect_decide_hmo")?.body ?? "";

describe("HMO decision migration (0037)", () => {
  it("defines cammi_connect_decide_hmo", () => {
    expect(decide).not.toBe("");
  });

  it("lets only active front desk or admin staff decide, only from hmo_pending on a pending request", () => {
    expect(decide).toMatch(/role in \('front_desk', 'admin'\)/);
    expect(decide).toMatch(/is_active/);
    expect(decide).toMatch(/raise exception 'not_allowed'/);
    expect(decide).toMatch(/v_payment\.status <> 'hmo_pending'/);
    expect(decide).toMatch(/raise exception 'not_open'/);
    expect(decide).toMatch(/<> 'requested'/);
    expect(decide).toMatch(/raise exception 'not_pending'/);
    expect(decide).toMatch(/for update/);
  });

  it("approves with an LOA number", () => {
    expect(decide).toMatch(/raise exception 'loa_required'/);
    expect(decide).toMatch(/'hmo_approved'/);
    expect(decide).toMatch(/hmo_loa_number = v_loa/);
  });

  it("denies with a reason and switches the charge to self-pay without the HMO line", () => {
    expect(decide).toMatch(/raise exception 'reason_required'/);
    expect(decide).toMatch(/update public\.appointment_charge_items[\s\S]*hmo_centavos = 0/);
    expect(decide).toMatch(/update public\.appointment_charges[\s\S]*payer = 'self'[\s\S]*hmo_centavos = 0/);
    expect(decide).toMatch(/'awaiting_payment'/);
    expect(decide).toMatch(/'qr_ph'/);
  });

  it("gives a new deadline per payment.deadline_minutes, never later than 2 hours before the visit", () => {
    const fallback = decide.match(/'payment\.deadline_minutes'\s*\),\s*(\d+)\)/)?.[1];
    expect(Number(fallback)).toBe(DEFAULT_SETTINGS["payment.deadline_minutes"]);
    expect(decide).toMatch(/least\(\s*now\(\) \+ make_interval\(mins => v_deadline_minutes\),\s*v_appointment\.scheduled_at - interval '2 hours'/);
    // Too late for a QR payment: the cashier collects at the visit.
    expect(decide).toMatch(/'collect_at_counter'/);
  });

  it("writes a payment_events row for both decisions", () => {
    expect(decide).toMatch(/insert into public\.payment_events/);
    expect(decide).toMatch(/'hmo_approved'/);
    expect(decide).toMatch(/'hmo_denied'/);
  });

  it("lets a self-pay charge keep the HMO details after a denial", () => {
    expect(MIGRATION).toMatch(/drop constraint if exists appointment_charges_hmo_details/);
    expect(MIGRATION).toMatch(/payer <> 'hmo' or hmo_provider_id is not null/);
  });

  it("locks the function down per ADR-0003", () => {
    expect(MIGRATION).not.toMatch(/create policy/i);
    expect(MIGRATION).toMatch(
      /revoke all on function public\.cammi_connect_decide_hmo\([^)]*\)\s*from public, anon, authenticated;\s*grant execute on function public\.cammi_connect_decide_hmo\([^)]*\)\s*to service_role;/,
    );
  });
});
