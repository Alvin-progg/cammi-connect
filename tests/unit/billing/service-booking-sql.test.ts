// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APPOINTMENT_KINDS, SLOT_HOLDING_STATUSES } from "@/lib/appointments/status";
import { PRIVILEGE_DISCOUNT_BPS } from "@/lib/billing/compute";
import { SLOT_DURATIONS } from "@/lib/schedules/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * PAY-07: service visits and their booking live in SQL (0038). These static
 * checks keep the migration in step with the TS lists and the PAY-001 rules;
 * the functions are smoke-tested against a local database (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0038_service_booking.sql"), "utf8");
const bodies = functionBodies(MIGRATION);
const body = (name: string) => bodies.find((fn) => fn.name === name)?.body ?? "";
const book = body("cammi_connect_book_service");
const confirm = body("cammi_connect_confirm_appointment");
const notify = body("cammi_connect_notify_doctor");
const saveSchedule = body("cammi_connect_admin_save_service_schedule");
const load = body("cammi_connect_service_load");

describe("service booking migration (0038)", () => {
  it("adds appointments.kind with the TS kinds and allows a null doctor only for services", () => {
    const kinds = MIGRATION.match(/kind in \(([^)]*)\)/)?.[1] ?? "";
    expect([...kinds.matchAll(/'(\w+)'/g)].map((match) => match[1])).toEqual([...APPOINTMENT_KINDS]);
    expect(MIGRATION).toMatch(/alter column doctor_id drop not null/);
    expect(MIGRATION).toMatch(
      /\(kind = 'consultation' and doctor_id is not null and service_id is null\)\s*or \(kind = 'service' and doctor_id is null and service_id is not null\)/,
    );
  });

  it("adds service_schedules with the doctor-period rules and locks it down per ADR-0003", () => {
    expect(MIGRATION).toMatch(/create table if not exists public\.service_schedules/);
    expect(MIGRATION).toContain(`slot_minutes in (${SLOT_DURATIONS.join(", ")})`);
    expect(MIGRATION).toMatch(/service_schedules_no_active_overlap exclude using gist/);
    expect(MIGRATION).toContain("alter table public.service_schedules enable row level security");
    expect(MIGRATION).toMatch(/revoke all on table public\.service_schedules from anon, authenticated/);
    expect(MIGRATION).not.toMatch(/create policy/i);
  });

  it("grants every new function to service_role only", () => {
    for (const name of [
      "cammi_connect_book_service",
      "cammi_connect_service_load",
      "cammi_connect_admin_save_service_schedule",
    ]) {
      expect(MIGRATION).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([^)]*\\)\\s*from public, anon, authenticated;`),
      );
      expect(MIGRATION).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\)\\s*to service_role;`));
    }
  });

  it("books only walk-in or scheduled services that have a price", () => {
    expect(book).toMatch(/booking_mode not in \('walk_in', 'scheduled'\)/);
    expect(book).toMatch(/raise exception 'service_unavailable'/);
    expect(book).toMatch(/raise exception 'price_on_request'/);
    expect(book).toMatch(/raise exception 'invalid_service_combination'/);
  });

  it("locks the services and the patient, then checks the patient cap", () => {
    expect(book).toMatch(/from public\.services[\s\S]*for update/);
    expect(book).toMatch(/from public\.profiles[\s\S]*for update/);
    expect(book).toMatch(/raise exception 'too_many_upcoming'/);
  });

  it("checks daily and per-slot capacity with the shared load function", () => {
    expect(book).toMatch(/public\.cammi_connect_service_load\(/);
    expect(book).toMatch(/raise exception 'service_full'/);
    expect(book).toMatch(/raise exception 'slot_full'/);
    const statuses = load.match(/status in \(([^)]*)\)/)?.[1] ?? "";
    expect([...statuses.matchAll(/'(\w+)'/g)].map((match) => match[1])).toEqual([
      ...SLOT_HOLDING_STATUSES,
    ]);
  });

  it("respects hospital-wide holidays", () => {
    expect(book).toMatch(/public\.cammi_connect_exception_blocks\(\s*null/);
    expect(book).toMatch(/raise exception 'blocked'/);
  });

  it("writes the appointment, charge, lines, payment, and events in the same function", () => {
    expect(book).toMatch(/insert into public\.appointments\s*\(/);
    expect(book).toMatch(/'service'/);
    expect(book).toMatch(/insert into public\.appointment_audit_logs/);
    expect(book).toMatch(/insert into public\.appointment_charges/);
    expect(book).toMatch(/insert into public\.appointment_charge_items/);
    expect(book).toMatch(/insert into public\.payments/);
    expect(book).toMatch(/insert into public\.payment_events[\s\S]*'created', null, v_status/);
  });

  it("recomputes the price like 0034 and refuses a summary that no longer matches", () => {
    expect(book).toContain(`* ${PRIVILEGE_DISCOUNT_BPS} + 10000) / 20000`);
    expect(book).toMatch(/p_expected_amount_due_centavos is distinct from v_total_due/);
    expect(book).toMatch(/raise exception 'price_changed'/);
    expect(MIGRATION).not.toMatch(/\b(numeric|real|double precision|float\d?)\b/);
  });

  it("clamps the deadline like 0034 and uses the TS default", () => {
    expect(book).toMatch(/raise exception 'payment_too_soon'/);
    expect(book).toMatch(/v_scheduled_at - interval '2 hours'/);
    const fallback = book.match(/'payment\.deadline_minutes'\s*\),\s*(\d+)\)/)?.[1];
    expect(Number(fallback)).toBe(DEFAULT_SETTINGS["payment.deadline_minutes"]);
  });

  it("keeps the confirm payment gate and skips doctor checks only for service visits", () => {
    expect(confirm).toMatch(
      /v_payment_status not in \('verified', 'hmo_approved', 'not_required', 'collect_at_counter'\)/,
    );
    expect(confirm).toMatch(/v_appointment\.kind = 'service'/);
    expect(confirm).toMatch(/raise exception 'inactive_doctor'/);
    expect(confirm).toMatch(/insert into public\.appointment_audit_logs/);
  });

  it("never notifies a doctor about a service visit", () => {
    expect(notify).toMatch(/if new\.doctor_id is null then\s*return null;/);
  });

  it("audits every service schedule save and re-checks the admin", () => {
    expect(saveSchedule).toMatch(/cammi_connect_require_admin_actor\(p_actor_profile_id\)/);
    expect(saveSchedule).toMatch(/insert into public\.audit_logs/);
    expect(saveSchedule).toMatch(/'service_schedule'/);
  });
});
