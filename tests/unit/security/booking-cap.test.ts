// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * The per-patient booking cap lives in SQL (0031), which cannot run without a
 * database (ADR-0003). These static checks keep the migration and the TS
 * settings in step; the count itself is covered by the db/README.md smoke test.
 */

const MIGRATION = readFileSync(join(MIGRATIONS_DIR, "0031_patient_booking_cap.sql"), "utf8");
const bodies = functionBodies(MIGRATION);
const bookBody = bodies.find(({ name }) => name === "cammi_connect_book_appointment")?.body ?? "";
const settingsBody =
  bodies.find(({ name }) => name === "cammi_connect_admin_save_settings")?.body ?? "";

describe("per-patient booking cap (0031)", () => {
  it("rejects a patient booking at the cap", () => {
    expect(bookBody).toMatch(/raise exception 'too_many_upcoming'/);
    expect(bookBody).toMatch(/status in \('requested', 'confirmed'\)/);
    expect(bookBody).toMatch(/scheduled_at > now\(\)/);
  });

  it("locks the patient so parallel bookings cannot both pass the count", () => {
    expect(bookBody).toMatch(
      /from public\.profiles\s+where id = p_patient_id\s+for update/,
    );
  });

  it("uses the same default cap as the TS settings", () => {
    const match = bookBody.match(
      /'appointment\.max_upcoming_per_patient'\s*\),\s*(\d+)\s*\)/,
    );
    expect(Number(match?.[1])).toBe(DEFAULT_SETTINGS["appointment.max_upcoming_per_patient"]);
  });

  it("lets admins save the cap setting", () => {
    expect(settingsBody).toContain("'appointment.max_upcoming_per_patient'");
  });

  it("leaves the front desk booking function unchanged, so staff bookings are not capped", () => {
    expect(bodies.map(({ name }) => name)).not.toContain(
      "cammi_connect_front_desk_book_appointment",
    );
  });
});
