// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { migrationFunctionBodies } from "../../helpers/sql";

/**
 * ADM-09 asks for every appointment status change to leave an
 * `appointment_audit_logs` row. Instead of a trigger, each writer inserts the
 * row itself (decision 2026-11-05). These checks keep that true as new
 * migrations and server code are added:
 *   - every SQL function body that inserts or updates an appointment (status
 *     changes and reschedules) also inserts into appointment_audit_logs;
 *   - in TypeScript, only the audited appointments repository updates the
 *     table (its transition path is covered by mutations/patient-service
 *     tests asserting `insertHistory`).
 */

const ROOT = process.cwd();

const APPOINTMENT_UPDATE = /update\s+public\.appointments\b/i;
const APPOINTMENT_INSERT = /insert\s+into\s+public\.appointments\s*\(/i;
const AUDIT_INSERT = /insert\s+into\s+public\.appointment_audit_logs\b/i;

describe("appointment audit coverage", () => {
  const writers = migrationFunctionBodies().filter(
    ({ body }) => APPOINTMENT_UPDATE.test(body) || APPOINTMENT_INSERT.test(body),
  );

  it("finds the appointment writer functions", () => {
    // Guards the parser itself: confirm/reject, attendance, reschedule/cancel,
    // and booking functions all write appointments.
    expect(writers.length).toBeGreaterThanOrEqual(6);
  });

  it("records an audit row in every SQL function that creates or updates an appointment", () => {
    const unaudited = writers
      .filter(({ body }) => !AUDIT_INSERT.test(body))
      .map(({ file, name }) => `${file}: ${name}`);
    // Pre-0007 functions predate appointment_audit_logs and were replaced.
    const current = unaudited.filter((entry) => entry >= "0007");

    expect(current).toEqual([]);
  });

  it("updates appointments from TypeScript only in the audited appointments repository", () => {
    const serverDir = join(ROOT, "src/server");
    const files = readdirSync(serverDir, { recursive: true, encoding: "utf8" }).filter((file) =>
      file.endsWith(".ts"),
    );
    const updaters = files.filter((file) => {
      const source = readFileSync(join(serverDir, file), "utf8");
      return /from\("appointments"\)\s*\.update\(/.test(source);
    });

    expect(updaters).toEqual([join("appointments", "repository.ts")]);
  });
});
