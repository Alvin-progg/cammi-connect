import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";
import { PATIENT_NOTIFICATION_TYPES, PATIENT_NOTIFICATION_TYPE_LABELS } from "@/lib/notifications/types";

const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf8");
const ENUM_MIGRATION = "0046_patient_notification_benefit_types.sql";
const OUTBOX_MIGRATION = "0047_notification_email_outbox.sql";
const BENEFIT_TYPES = ["pwd_verified", "pwd_rejected", "hmo_membership_verified", "hmo_membership_rejected"];

describe("benefit notification types (0046)", () => {
  it("only adds enum values, so it can run on its own before 0047", () => {
    const sql = read(ENUM_MIGRATION);
    for (const type of BENEFIT_TYPES) {
      expect(sql).toContain(`alter type public.patient_notification_type add value if not exists '${type}'`);
    }
    expect(sql).not.toMatch(/create (or replace )?(function|trigger|table)/i);
  });

  it("has a TS type and label for each new value", () => {
    for (const type of BENEFIT_TYPES) {
      expect(PATIENT_NOTIFICATION_TYPES).toContain(type);
      expect(PATIENT_NOTIFICATION_TYPE_LABELS[type as (typeof PATIENT_NOTIFICATION_TYPES)[number]]).toBeTruthy();
    }
  });
});

describe("notification email outbox (0047)", () => {
  it("adds email delivery columns to both notification tables", () => {
    const sql = read(OUTBOX_MIGRATION);
    for (const table of ["patient_notifications", "doctor_notifications"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table}[\\s\\S]*?add column if not exists emailed_at timestamptz`));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table}[\\s\\S]*?add column if not exists email_attempts`));
    }
  });

  it("notifies the patient when front desk decides a PWD or HMO membership", () => {
    const sql = read(OUTBOX_MIGRATION);
    expect(sql).toMatch(/after update of verification_status on public\.patient_pwd/);
    expect(sql).toMatch(/after update of verification_status on public\.patient_hmo/);

    const body = functionBodies(sql).find((fn) => fn.name === "cammi_connect_notify_patient_benefit")?.body ?? "";
    for (const type of BENEFIT_TYPES) expect(body).toContain(`'${type}'`);
    expect(body).toContain("insert into public.patient_notifications");
    expect(body).toMatch(/auth_user_id is not null/);
  });

  it("keeps ID numbers, member numbers, and rejection reasons out of the text", () => {
    const body =
      functionBodies(read(OUTBOX_MIGRATION)).find((fn) => fn.name === "cammi_connect_notify_patient_benefit")?.body ?? "";
    expect(body).not.toMatch(/pwd_id_number|membership_number|rejection_reason/);
  });

  it("sets an empty search path on the trigger function", () => {
    expect(read(OUTBOX_MIGRATION)).toMatch(/set search_path = ''/);
  });
});
