// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * Benefits slice (0041). Static checks keep the SQL in step with the spec
 * (PWD/HMO verification, per-doctor accreditation, appointment HMO). The
 * functions are smoke-tested against a local database (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0041_patient_benefits.sql"), "utf8");
const bodyOf = (name: string) => functionBodies(MIGRATION).find((fn) => fn.name === name)?.body ?? "";

const FUNCTIONS = [
  "cammi_connect_submit_pwd",
  "cammi_connect_submit_hmo",
  "cammi_connect_decide_pwd",
  "cammi_connect_decide_hmo_membership",
  "cammi_connect_save_doctor_hmo_accreditation",
  "cammi_connect_update_appointment_hmo",
];

describe("benefits migration (0041)", () => {
  it("creates the four tables with RLS on and no anon/authenticated access", () => {
    for (const table of ["patient_pwd", "patient_hmo", "doctor_hmo_accreditations", "appointment_hmo"]) {
      expect(MIGRATION, table).toMatch(new RegExp(`create table if not exists public\\.${table} \\(`));
      expect(MIGRATION, table).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security;`),
      );
      expect(MIGRATION, table).toMatch(
        new RegExp(`revoke all on table public\\.${table} from anon, authenticated;`),
      );
    }
  });

  it("keeps the private benefit-documents bucket with the image types and 5 MB limit", () => {
    expect(MIGRATION).toMatch(/'benefit-documents', 'benefit-documents', false, 5242880/);
    expect(MIGRATION).toMatch(/array\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
  });

  it("defines every benefits function and grants execute to service_role only", () => {
    for (const name of FUNCTIONS) {
      expect(bodyOf(name), name).not.toBe("");
      expect(MIGRATION, name).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`),
      );
      expect(MIGRATION, name).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role;`),
      );
    }
  });

  it("pins search_path on every function", () => {
    for (const name of FUNCTIONS) {
      expect(bodyOf(name), name).toBeTruthy();
    }
    expect((MIGRATION.match(/set search_path = ''/g) ?? []).length).toBe(FUNCTIONS.length);
  });

  it("lets only active patients submit their own PWD and HMO records", () => {
    for (const name of ["cammi_connect_submit_pwd", "cammi_connect_submit_hmo"]) {
      expect(bodyOf(name), name).toMatch(/profiles\.role = 'patient' and profiles\.is_active/);
      expect(bodyOf(name), name).toMatch(/raise exception 'not_allowed'/);
    }
  });

  it("returns a PWD or HMO submission to pending, clearing the earlier review", () => {
    const pwd = bodyOf("cammi_connect_submit_pwd");
    expect(pwd).toMatch(/verification_status = 'pending'/);
    expect(pwd).toMatch(/verified_by = null/);
    expect(pwd).toMatch(/rejection_reason = null/);
    const hmo = bodyOf("cammi_connect_submit_hmo");
    expect(hmo).toMatch(/verification_status = 'pending'/);
    expect(hmo).toMatch(/verified_by = null/);
  });

  it("refuses an HMO submission for an inactive provider", () => {
    expect(bodyOf("cammi_connect_submit_hmo")).toMatch(/providers\.is_active[\s\S]*raise exception 'provider_inactive'/);
  });

  it("lets only active front desk or admin staff decide, only from pending, and locks the row", () => {
    for (const name of ["cammi_connect_decide_pwd", "cammi_connect_decide_hmo_membership"]) {
      const body = bodyOf(name);
      expect(body, name).toMatch(/role in \('front_desk', 'admin'\) and profiles\.is_active/);
      expect(body, name).toMatch(/raise exception 'not_allowed'/);
      expect(body, name).toMatch(/for update/);
      expect(body, name).toMatch(/verification_status <> 'pending'[\s\S]*raise exception 'not_pending'/);
    }
  });

  it("requires a reason to reject, and only verify/reject are accepted", () => {
    for (const name of ["cammi_connect_decide_pwd", "cammi_connect_decide_hmo_membership"]) {
      const body = bodyOf(name);
      expect(body, name).toMatch(/p_decision not in \('verify', 'reject'\)/);
      expect(body, name).toMatch(/raise exception 'reason_required'/);
    }
  });

  it("audits every PWD and HMO decision", () => {
    expect(bodyOf("cammi_connect_decide_pwd")).toMatch(/'benefit\.pwd_verify'[\s\S]*'benefit\.pwd_reject'/);
    expect(bodyOf("cammi_connect_decide_hmo_membership")).toMatch(/'benefit\.hmo_verify'[\s\S]*'benefit\.hmo_reject'/);
  });

  it("keeps ID numbers, membership numbers, and image paths out of audit payloads", () => {
    const auditPayloads = FUNCTIONS.map((name) => bodyOf(name))
      .flatMap((body) => [...body.matchAll(/insert into public\.audit_logs[\s\S]*?\);/g)].map((m) => m[0]));
    expect(auditPayloads.length).toBeGreaterThan(0);
    for (const payload of auditPayloads) {
      expect(payload).not.toMatch(/pwd_id_number|membership_number|image_path|card/);
    }
  });

  it("lets only active admins save doctor HMO accreditation, and refuses bad input", () => {
    const body = bodyOf("cammi_connect_save_doctor_hmo_accreditation");
    expect(body).toMatch(/role = 'admin' and profiles\.is_active/);
    expect(body).toMatch(/raise exception 'provider_inactive'/);
    expect(body).toMatch(/raise exception 'invalid_status'/);
    expect(body).toMatch(/p_valid_until < p_valid_from[\s\S]*raise exception 'invalid_dates'/);
    expect(body).toMatch(/on conflict \(doctor_id, hmo_provider_id\)/);
    expect(body).toMatch(/'doctor_hmo\.save'/);
  });

  it("lets front desk or admin update appointment HMO authorization and coverage independently", () => {
    const body = bodyOf("cammi_connect_update_appointment_hmo");
    expect(body).toMatch(/role in \('front_desk', 'admin'\) and profiles\.is_active/);
    expect(body).toMatch(/raise exception 'not_found'/);
    expect(body).toMatch(/authorization_status = p_authorization_status/);
    expect(body).toMatch(/coverage_status = p_coverage_status/);
    expect(body).toMatch(/'appointment_hmo\.update'/);
  });

  it("snapshots the provider, membership, and accreditation on each appointment HMO row", () => {
    for (const column of [
      "provider_name_snapshot",
      "membership_number_snapshot",
      "accreditation_status_snapshot",
      "accreditation_valid_from_snapshot",
      "accreditation_valid_until_snapshot",
    ]) {
      expect(MIGRATION).toMatch(new RegExp(`${column} `));
    }
  });

  it("keeps verified records consistent with their reviewer and rejected records with a reason", () => {
    expect(MIGRATION).toMatch(/patient_pwd_verified_has_reviewer/);
    expect(MIGRATION).toMatch(/patient_pwd_rejected_has_reason/);
    expect(MIGRATION).toMatch(/patient_hmo_verified_has_reviewer/);
    expect(MIGRATION).toMatch(/patient_hmo_rejected_has_reason/);
    expect(MIGRATION).toMatch(/doctor_hmo_accreditations_dates_order/);
  });
});
