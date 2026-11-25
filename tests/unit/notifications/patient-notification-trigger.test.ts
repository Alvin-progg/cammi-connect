import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";
import { PATIENT_NOTIFICATION_TYPES, PATIENT_NOTIFICATION_TYPE_LABELS } from "@/lib/notifications/types";

const MIGRATION = "0044_patient_notifications.sql";
const read = () => readFileSync(join(MIGRATIONS_DIR, MIGRATION), "utf8");

function bodyOf(name: string): string | undefined {
  return functionBodies(read()).find((fn) => fn.name === name)?.body;
}

describe("patient notification migration", () => {
  it("creates the table with RLS on and no anon/authenticated access", () => {
    const sql = read();
    expect(sql).toMatch(/create table if not exists public\.patient_notifications/);
    expect(sql).toMatch(/alter table public\.patient_notifications enable row level security/);
    expect(sql).toMatch(/revoke all on public\.patient_notifications from anon, authenticated/);
  });

  it("notifies from appointment events and from payment decisions", () => {
    const sql = read();
    expect(sql).toMatch(/after update on public\.appointments/);
    expect(sql).toMatch(/after update of status on public\.payments/);
  });

  it("writes a row for every appointment event the patient should hear about", () => {
    const body = bodyOf("cammi_connect_notify_patient_appointment");
    expect(body).toBeDefined();
    for (const type of ["confirmed", "rejected", "cancelled", "rescheduled"]) {
      expect(body).toContain(`'${type}'`);
    }
    expect(body).toContain("insert into public.patient_notifications");
  });

  it("does not notify the patient about their own cancellation or a system expiry", () => {
    const body = bodyOf("cammi_connect_notify_patient_appointment") ?? "";
    // Only staff roles notify; patient and system cancellations do not.
    expect(body).toMatch(/cancelled_by_role in \('front_desk', 'doctor', 'admin'\)/);
  });

  it("writes a row for each payment decision", () => {
    const body = bodyOf("cammi_connect_notify_patient_payment");
    expect(body).toBeDefined();
    for (const type of [
      "payment_verified",
      "payment_rejected",
      "hmo_approved",
      "hmo_denied",
      "payment_expired",
    ]) {
      expect(body).toContain(`'${type}'`);
    }
  });

  it("skips walk-in patients, who have no sign-in and cannot read notifications", () => {
    const body = bodyOf("cammi_connect_notify_patient_appointment") ?? "";
    expect(body).toMatch(/auth_user_id is not null/);
  });

  it("keeps bodies free of payment amounts, member numbers and reasons", () => {
    const sql = read();
    expect(sql).not.toMatch(/amount_due_centavos[^;]*v_body/);
    expect(sql).not.toMatch(/member_number[^;]*v_body/);
    expect(sql).not.toMatch(/rejected_reason[^;]*v_body/);
  });

  it("sets an empty search path on both trigger functions", () => {
    expect(read()).toMatch(/set search_path = ''/);
  });
});

describe("patient notification types", () => {
  it("has a label for every type", () => {
    for (const type of PATIENT_NOTIFICATION_TYPES) {
      expect(PATIENT_NOTIFICATION_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});
