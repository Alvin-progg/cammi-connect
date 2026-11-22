// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * BEN-02 (0042): booking with saved PWD/HMO, the front desk mirror, and the
 * backfill. Static checks; smoke-test against a local database is still
 * required (db/README.md).
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0042_benefit_booking.sql"), "utf8");
const bodyOf = (name: string) => functionBodies(MIGRATION).find((fn) => fn.name === name)?.body ?? "";
const resolve = bodyOf("cammi_connect_resolve_benefit_choice");

describe("benefit booking migration (0042)", () => {
  it("refuses the PWD privilege unless patient_pwd is verified", () => {
    expect(resolve).toMatch(/p_privilege = 'pwd'/);
    expect(resolve).toMatch(/v_pwd_status is distinct from 'verified'[\s\S]*raise exception 'pwd_not_verified'/);
  });

  it("requires a verified membership that belongs to the patient and an active provider", () => {
    expect(resolve).toMatch(/membership\.patient_id = p_patient_id/);
    expect(resolve).toMatch(/raise exception 'hmo_required'/);
    expect(resolve).toMatch(/raise exception 'hmo_unavailable'/);
    expect(resolve).toMatch(/verification_status <> 'verified'[\s\S]*raise exception 'hmo_not_verified'/);
    expect(resolve).toMatch(/providers\.is_active/);
  });

  it("checks the doctor's accreditation and its dates in Manila time, but not for service visits", () => {
    expect(resolve).toMatch(/if p_doctor_id is not null then/);
    expect(resolve).toMatch(/raise exception 'hmo_not_accepted'/);
    expect(resolve).toMatch(/Asia\/Manila/);
    expect(resolve).toMatch(/raise exception 'hmo_accreditation_expired'/);
    expect(resolve).toMatch(/v_accreditation_from > v_today/);
    expect(resolve).toMatch(/v_accreditation_until < v_today/);
  });

  it("refuses a saved membership id on a non-HMO payment", () => {
    expect(resolve).toMatch(/if p_payer <> 'hmo' then[\s\S]*raise exception 'invalid_payment_choice'/);
  });

  it("books through the existing RPCs and writes appointment_hmo with snapshots in the same function", () => {
    const consultation = bodyOf("cammi_connect_book_with_saved_hmo");
    expect(consultation).toMatch(/from public\.cammi_connect_book_with_charge\(/);
    expect(consultation).toMatch(/insert into public\.appointment_hmo/);
    expect(consultation).toMatch(/provider_name_snapshot/);
    expect(consultation).toMatch(/accreditation_status_snapshot/);

    const service = bodyOf("cammi_connect_book_service_with_saved_hmo");
    expect(service).toMatch(/from public\.cammi_connect_book_service\(/);
    expect(service).toMatch(/insert into public\.appointment_hmo/);
    expect(service).toMatch(/cammi_connect_resolve_benefit_choice\(\s*p_patient_id, null,/);
  });

  it("mirrors the front desk HMO decision into appointment_hmo", () => {
    const mirror = bodyOf("cammi_connect_mirror_hmo_decision");
    expect(mirror).toMatch(/'rejected'/);
    expect(mirror).toMatch(/'not_covered'/);
    expect(mirror).toMatch(/update public\.appointment_hmo/);
    expect(MIGRATION).toMatch(/after update of hmo_decided_at on public\.payments/);
  });

  it("backfills patient_hmo and appointment_hmo from existing HMO charges", () => {
    expect(MIGRATION).toMatch(/insert into public\.patient_hmo[\s\S]*on conflict \(patient_id, hmo_provider_id\) do nothing/);
    expect(MIGRATION).toMatch(/insert into public\.appointment_hmo[\s\S]*on conflict \(appointment_id\) do nothing/);
  });

  it("grants the new functions to service_role only", () => {
    for (const name of [
      "cammi_connect_resolve_benefit_choice",
      "cammi_connect_book_with_saved_hmo",
      "cammi_connect_book_service_with_saved_hmo",
    ]) {
      expect(MIGRATION, name).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to service_role;`));
    }
  });
});

describe("benefit document view (0042)", () => {
  const view = bodyOf("cammi_connect_record_benefit_document_view");

  it("lets only active front desk or admin staff view a document, and audits the view", () => {
    expect(view).toMatch(/role in \('front_desk', 'admin'\) and profiles\.is_active/);
    expect(view).toMatch(/raise exception 'not_allowed'/);
    expect(view).toMatch(/'benefit\.document_viewed'/);
  });

  it("returns only the path for a PWD or HMO record, and audits without the path", () => {
    expect(view).toMatch(/pwd_id_image_path/);
    expect(view).toMatch(/hmo_card_image_path/);
    const audit = view.match(/insert into public\.audit_logs[\s\S]*?\);/)?.[0] ?? "";
    expect(audit).not.toMatch(/path|pwd_id_number|membership_number/);
  });
});

describe("benefit document view keys (0042)", () => {
  it("looks a PWD record up by patient, and audits the PWD row ID", () => {
    const view = bodyOf("cammi_connect_record_benefit_document_view");
    expect(view).toMatch(/where pwd\.patient_id = p_record_id/);
    expect(view).toMatch(/select pwd\.id, pwd\.pwd_id_image_path into v_target_id, v_path/);
    expect(view).toMatch(/v_target_id::text/);
  });
});
