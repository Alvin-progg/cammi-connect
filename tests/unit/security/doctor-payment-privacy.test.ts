// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * PAY-001 "Doctors never see payment data". The doctor dashboard's routes,
 * components, and server reads never touch payment tables, receipts, or the
 * billing modules. Front desk and admin pages are the only payment views.
 */
const ROOT = process.cwd();
const DOCTOR_FACING = [
  "src/app/doctor",
  "src/components/doctor",
  "src/server/appointments",
  "src/server/notifications",
];
const PAYMENT_DATA =
  /\b(payments|payment_receipts|payment_events|appointment_charges|appointment_charge_items)\b|payment-receipts|@\/lib\/billing|@\/server\/payments|PaymentPanel/;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => join(dir, file));
}

describe("doctor payment privacy", () => {
  const files = DOCTOR_FACING.flatMap(sourceFiles);

  it("finds the doctor-facing files", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it("never reads or renders payment data in doctor-facing code", () => {
    const offending = files.filter((file) => PAYMENT_DATA.test(readFileSync(join(ROOT, file), "utf8")));
    expect(offending).toEqual([]);
  });

  it("detects payment reads (self-check)", () => {
    expect(PAYMENT_DATA.test('supabase.from("payments")')).toBe(true);
    expect(PAYMENT_DATA.test('import { x } from "@/server/payments/verification"')).toBe(true);
    expect(PAYMENT_DATA.test("appointment payment is due")).toBe(false);
  });
});
