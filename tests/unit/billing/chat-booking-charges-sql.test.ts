// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PRIVILEGE_DISCOUNT_BPS } from "@/lib/billing/compute";
import { PAYMENT_STATUSES } from "@/lib/billing/payments";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * PAY-03: charges and payments live in SQL (0034). These static checks keep
 * the migration in step with the TS lists and rules; the function itself is
 * smoke-tested against a local database (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0034_chat_booking_charges.sql"), "utf8");
const book =
  functionBodies(MIGRATION).find(({ name }) => name === "cammi_connect_book_with_charge")?.body ?? "";

describe("chat booking charges migration (0034)", () => {
  it("has every payment status the TS list has", () => {
    const enumBody = MIGRATION.match(/create type public\.payment_status as enum \(([^)]*)\)/)?.[1] ?? "";
    const values = [...enumBody.matchAll(/'(\w+)'/g)].map((match) => match[1]);
    expect(values).toEqual([...PAYMENT_STATUSES]);
  });

  it("locks every new table down per ADR-0003", () => {
    for (const table of ["appointment_charges", "appointment_charge_items", "payments", "payment_events"]) {
      expect(MIGRATION).toContain(`alter table public.${table} enable row level security`);
      expect(MIGRATION).toMatch(new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
    }
    expect(MIGRATION).not.toMatch(/create policy/i);
    expect(MIGRATION).toMatch(/from public, anon, authenticated;\s*grant execute[^;]*to service_role;/);
  });

  it("keeps payment_events append-only", () => {
    expect(MIGRATION).toMatch(/before update or delete on public\.payment_events/);
    expect(MIGRATION).toMatch(/before truncate on public\.payment_events/);
    expect(MIGRATION).toMatch(/grant select, insert on table public\.payment_events to service_role/);
  });

  it("makes reference codes and transaction references unique", () => {
    expect(MIGRATION).toMatch(/reference_code text not null unique/);
    expect(MIGRATION).toMatch(
      /create unique index if not exists payments_transaction_reference_key\s+on public\.payments \(upper\(btrim\(transaction_reference\)\)\)\s+where transaction_reference is not null/,
    );
  });

  it("books through the capped booking function in the same transaction", () => {
    expect(book).toMatch(/public\.cammi_connect_book_appointment\(/);
    expect(book).not.toMatch(/insert into public\.appointments\b/);
  });

  it("reads the price from the database and refuses a summary that no longer matches", () => {
    expect(book).toMatch(/coalesce\(v_doctor_fee, v_specialty_fee\)/);
    expect(book).toMatch(/raise exception 'price_on_request'/);
    expect(book).toMatch(/p_expected_amount_due_centavos is distinct from v_remaining/);
    expect(book).toMatch(/raise exception 'price_changed'/);
    expect(book).toContain(`* ${PRIVILEGE_DISCOUNT_BPS} + 10000) / 20000`);
    expect(MIGRATION).not.toMatch(/\b(numeric|real|double precision|float\d?)\b/);
  });

  it("clamps the deadline to 2 hours before the visit and uses the TS default", () => {
    expect(book).toMatch(/raise exception 'payment_too_soon'/);
    expect(book).toMatch(/p_scheduled_at - interval '2 hours'/);
    const fallback = book.match(/'payment\.deadline_minutes'\s*\),\s*(\d+)\)/)?.[1];
    expect(Number(fallback)).toBe(DEFAULT_SETTINGS["payment.deadline_minutes"]);
  });

  it("records a created event with the new payment", () => {
    expect(book).toMatch(/insert into public\.payment_events[\s\S]*'created', null, v_status/);
  });
});
