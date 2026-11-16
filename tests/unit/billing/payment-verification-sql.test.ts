// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONFIRMABLE_PAYMENT_STATUSES, RECEIPT_REJECTION_REASONS } from "@/lib/billing/verification";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * PAY-05: front desk verification and the confirm gate (0036). Static checks
 * keep the SQL in step with the TS rules; the functions are smoke-tested
 * against a local database (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0036_payment_verification.sql"), "utf8");
const bodies = functionBodies(MIGRATION);
const body = (name: string) => bodies.find((fn) => fn.name === name)?.body ?? "";

const confirm = body("cammi_connect_confirm_appointment");
const verify = body("cammi_connect_verify_payment");
const reject = body("cammi_connect_reject_payment_receipt");
const refunded = body("cammi_connect_mark_refunded");
const viewed = body("cammi_connect_record_receipt_view");
const onCancel = body("cammi_connect_payment_refund_on_cancel");

describe("payment verification migration (0036)", () => {
  it("defines every PAY-05 function", () => {
    for (const fn of [confirm, verify, reject, refunded, viewed, onCancel]) {
      expect(fn).not.toBe("");
    }
  });

  it("confirms only when the payment allows it, or there is no payment row", () => {
    const allowed = CONFIRMABLE_PAYMENT_STATUSES.map((status) => `'${status}'`).join(", ");
    expect(confirm).toContain(`not in (${allowed})`);
    expect(confirm).toMatch(/raise exception 'payment_not_verified'/);
    // Locks the payment so a verify and a confirm never interleave.
    expect(confirm).toMatch(/from public\.payments[\s\S]*for update/);
    // The 0009 checks stay.
    for (const code of ["not_found", "not_pending", "inactive_doctor", "past", "outside_hours", "blocked"]) {
      expect(confirm).toContain(`'${code}'`);
    }
    expect(confirm).toMatch(/insert into public\.appointment_audit_logs/);
  });

  it("lets only active front desk or admin staff decide", () => {
    for (const fn of [verify, reject, refunded, viewed]) {
      expect(fn).toMatch(/role in \('front_desk', 'admin'\)/);
      expect(fn).toMatch(/is_active/);
      expect(fn).toMatch(/raise exception 'not_allowed'/);
    }
  });

  it("verifies with a unique reference and at least the amount due", () => {
    expect(verify).toMatch(/not in \('awaiting_payment', 'submitted', 'rejected'\)/);
    expect(verify).toMatch(/raise exception 'reference_required'/);
    expect(verify).toMatch(/upper\(btrim\(payments\.transaction_reference\)\) = upper\(v_reference\)/);
    expect(verify).toMatch(/raise exception 'duplicate_reference'/);
    expect(verify).toMatch(/p_amount_received_centavos < v_payment\.amount_due_centavos/);
    expect(verify).toMatch(/raise exception 'amount_short'/);
    expect(verify).toMatch(/raise exception 'invalid_received_at'/);
    expect(verify).toMatch(/status = 'verified'/);
    expect(verify).toMatch(/outcome = 'verified'/);
    expect(verify).toMatch(/insert into public\.payment_events[\s\S]*'verified'/);
  });

  it("rejects a submitted receipt with a preset reason", () => {
    const codes = RECEIPT_REJECTION_REASONS.map((reason) => `'${reason}'`).join(", ");
    expect(reject).toContain(`not in (${codes})`);
    expect(reject).toMatch(/v_payment\.status <> 'submitted'/);
    expect(reject).toMatch(/raise exception 'reason_required'/);
    expect(reject).toMatch(/status = 'rejected'/);
    expect(reject).toMatch(/outcome = 'rejected'/);
    expect(reject).toMatch(/insert into public\.payment_events[\s\S]*'rejected'/);
  });

  it("decides only while the appointment is still a pending request", () => {
    for (const fn of [verify, reject]) {
      expect(fn).toMatch(/<> 'requested'/);
      expect(fn).toMatch(/raise exception 'not_pending'/);
    }
  });

  it("marks a refund_due payment refunded with a reference", () => {
    expect(refunded).toMatch(/v_payment\.status <> 'refund_due'/);
    expect(refunded).toMatch(/raise exception 'reference_required'/);
    expect(refunded).toMatch(/status = 'refunded'/);
    expect(refunded).toMatch(/insert into public\.payment_events[\s\S]*'refunded'/);
  });

  it("audits every receipt view in payment_events and audit_logs", () => {
    expect(viewed).toMatch(/insert into public\.payment_events[\s\S]*'receipt_viewed'/);
    expect(viewed).toMatch(/insert into public\.audit_logs[\s\S]*'payment\.receipt_viewed'/);
    expect(viewed).toMatch(/raise exception 'receipt_not_found'/);
  });

  it("applies the D4 refund rule when a paid appointment is cancelled or rejected", () => {
    expect(MIGRATION).toMatch(
      /create trigger appointments_payment_refund\s+after update of status on public\.appointments/,
    );
    expect(onCancel).toMatch(/new\.status not in \('cancelled', 'rejected'\) or old\.status = new\.status/);
    expect(onCancel).toMatch(/status = 'verified'/);
    expect(onCancel).toMatch(/cancelled_by_role = 'patient'/);
    const fallback = onCancel.match(/'payment\.refund_cutoff_hours'\s*\),\s*(\d+)\)/)?.[1];
    expect(Number(fallback)).toBe(DEFAULT_SETTINGS["payment.refund_cutoff_hours"]);
    expect(onCancel).toMatch(/status = 'refund_due'/);
    expect(onCancel).toMatch(/'no_refund'/);
  });

  it("locks every function down per ADR-0003", () => {
    expect(MIGRATION).not.toMatch(/create policy/i);
    const revokes = MIGRATION.match(/from public, anon, authenticated;\s*grant execute[^;]*to service_role;/g);
    expect(revokes?.length).toBeGreaterThanOrEqual(5);
  });
});
