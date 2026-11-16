// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  RECEIPT_MAX_BYTES,
  RECEIPT_UPLOADS_PER_WINDOW,
  RECEIPT_WINDOW_MINUTES,
} from "@/lib/billing/receipts";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * PAY-04: receipt storage and submission (0035). Static checks keep the SQL
 * in step with the TS limits; the function itself is smoke-tested against a
 * local database (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0035_payment_receipts.sql"), "utf8");
const submit =
  functionBodies(MIGRATION).find(({ name }) => name === "cammi_connect_submit_payment_receipt")
    ?.body ?? "";

describe("payment receipts migration (0035)", () => {
  it("creates a private payment-receipts bucket limited to 5 MB JPEG/PNG/WebP", () => {
    expect(MIGRATION).toMatch(/insert into storage\.buckets/);
    expect(MIGRATION).toMatch(/'payment-receipts',\s*'payment-receipts',\s*false/);
    expect(MIGRATION).toContain(String(RECEIPT_MAX_BYTES));
    expect(MIGRATION).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(MIGRATION).toMatch(/on conflict \(id\) do update/);
  });

  it("adds no storage or table policies and locks payment_receipts down per ADR-0003", () => {
    expect(MIGRATION).not.toMatch(/create policy/i);
    expect(MIGRATION).toContain("alter table public.payment_receipts enable row level security");
    expect(MIGRATION).toMatch(/revoke all on table public\.payment_receipts from anon, authenticated/);
    expect(MIGRATION).toMatch(/from public, anon, authenticated;\s*grant execute[^;]*to service_role;/);
  });

  it("reports another patient's payment as not found", () => {
    expect(submit).toMatch(/appointments\.patient_id = p_patient_id/);
    expect(submit).toMatch(/raise exception 'payment_not_found'/);
  });

  it("accepts a receipt only while the payment awaits one", () => {
    expect(submit).toMatch(/not in \('awaiting_payment', 'rejected'\)/);
    expect(submit).toMatch(/raise exception 'payment_not_open'/);
  });

  it("enforces the attempt limit with the TS default", () => {
    const fallback = submit.match(/'payment\.max_receipts'\s*\),\s*(\d+)\)/)?.[1];
    expect(Number(fallback)).toBe(DEFAULT_SETTINGS["payment.max_receipts"]);
    expect(submit).toMatch(/raise exception 'receipt_limit_reached'/);
  });

  it("limits uploads per patient per window, counted from payment_receipts", () => {
    expect(submit).toContain(`interval '${RECEIPT_WINDOW_MINUTES} minutes'`);
    expect(submit).toMatch(new RegExp(`>= ${RECEIPT_UPLOADS_PER_WINDOW}\\b`));
    expect(submit).toMatch(/raise exception 'receipt_rate_limited'/);
  });

  it("only stores paths under the patient's and payment's folder", () => {
    expect(submit).toMatch(/p_patient_id::text \|\| '\/' \|\| p_payment_id::text \|\| '\/%'/);
  });

  it("moves the payment to submitted and records the event", () => {
    expect(submit).toMatch(/status = 'submitted'/);
    expect(submit).toMatch(/attempts = payments\.attempts \+ 1/);
    expect(submit).toMatch(/insert into public\.payment_events[\s\S]*'receipt_submitted'/);
  });
});
