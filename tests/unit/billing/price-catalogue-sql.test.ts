// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { SERVICE_BOOKING_MODES, SERVICE_CATEGORIES } from "@/lib/services/types";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * PAY-01: the price catalogue lives in SQL (0033). These static checks keep
 * the migration in step with the TS schemas; the functions themselves are
 * smoke-tested against a local database.
 */
const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0033_price_catalogue.sql"), "utf8");
const bodies = functionBodies(MIGRATION);
const body = (name: string) => bodies.find((fn) => fn.name === name)?.body ?? "";

describe("price catalogue migration (0033)", () => {
  it("adds nullable, non-negative integer centavo fees to specialties and doctors", () => {
    expect(MIGRATION).toMatch(/add column if not exists default_consultation_fee_centavos integer/);
    expect(MIGRATION).toMatch(/add column if not exists consultation_fee_centavos integer/);
    expect(MIGRATION).toMatch(/default_consultation_fee_centavos >= 0/);
    expect(MIGRATION).toMatch(/consultation_fee_centavos >= 0/);
    expect(MIGRATION).not.toMatch(/\b(numeric|real|double precision|float\d?)\b/);
  });

  it("gives services every pricing column, and booking modes and categories match the TS lists", () => {
    for (const column of [
      "category text",
      "price_centavos integer",
      "vatable boolean",
      "philhealth_benefit_centavos integer",
      "hmo_coverable boolean",
      "requires_doctor_request boolean",
      "daily_capacity integer",
    ]) {
      expect(MIGRATION).toContain(`add column if not exists ${column}`);
    }
    for (const mode of SERVICE_BOOKING_MODES) {
      expect(MIGRATION).toMatch(new RegExp(`booking_mode in \\([^)]*'${mode}'`));
    }
    for (const category of SERVICE_CATEGORIES) {
      expect(MIGRATION).toMatch(new RegExp(`category in \\([^)]*'${category}'`));
    }
  });

  it("creates hmo_providers locked down per ADR-0003", () => {
    expect(MIGRATION).toMatch(/create table if not exists public\.hmo_providers/);
    expect(MIGRATION).toMatch(/alter table public\.hmo_providers enable row level security/);
    expect(MIGRATION).toMatch(/revoke all on table public\.hmo_providers from anon, authenticated/);
    expect(MIGRATION).not.toMatch(/create policy/i);
  });

  it("audits every price change in the save functions", () => {
    expect(body("cammi_connect_admin_save_specialty")).toMatch(
      /'default_consultation_fee_centavos', v_previous\.default_consultation_fee_centavos/,
    );
    expect(body("cammi_connect_admin_save_doctor")).toMatch(
      /'consultation_fee_centavos', v_previous_consultation_fee_centavos/,
    );
    const service = body("cammi_connect_admin_save_service");
    for (const column of [
      "category",
      "price_centavos",
      "vatable",
      "philhealth_benefit_centavos",
      "hmo_coverable",
      "requires_doctor_request",
      "daily_capacity",
    ]) {
      expect(service).toContain(`'${column}', v_previous.${column}`);
    }
    expect(body("cammi_connect_admin_save_hmo_provider")).toMatch(/'hmo_provider\.create'/);
    expect(body("cammi_connect_admin_set_hmo_provider_active")).toMatch(/'hmo_provider\.activate'/);
  });

  it("refuses negative amounts with invalid_price before writing", () => {
    for (const name of [
      "cammi_connect_admin_save_specialty",
      "cammi_connect_admin_save_doctor",
      "cammi_connect_admin_save_service",
      "cammi_connect_admin_save_hmo_provider",
    ]) {
      expect(body(name), name).toMatch(/raise exception 'invalid_price'/);
    }
  });

  it("drops the old save signatures and grants every function to service_role only", () => {
    expect(MIGRATION).toMatch(
      /drop function if exists public\.cammi_connect_admin_save_specialty\(uuid, uuid, text, text, text\)/,
    );
    expect(MIGRATION).toMatch(
      /drop function if exists public\.cammi_connect_admin_save_doctor\(uuid, uuid, uuid, text, uuid, text, text, text, uuid\[\]\)/,
    );
    expect(MIGRATION).toMatch(
      /drop function if exists public\.cammi_connect_admin_save_service\(uuid, uuid, text, text, uuid, boolean, text\)/,
    );
    const created = [...MIGRATION.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1]);
    for (const name of created) {
      expect(MIGRATION, name).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([^)]*\\)\\s+from public, anon, authenticated`),
      );
      expect(MIGRATION, name).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^)]*\\)\\s+to service_role`),
      );
    }
  });

  it("lets admins save every editable setting, but not the legal privilege discount", () => {
    const settings = body("cammi_connect_admin_save_settings");
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key === "billing.privilege_discount_bps") continue;
      expect(settings).toContain(`'${key}'`);
    }
    expect(settings).not.toContain("'billing.privilege_discount_bps'");
  });
});
