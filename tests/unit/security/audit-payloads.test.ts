// @vitest-environment node
import { describe, expect, it } from "vitest";

import { migrationFunctionBodies } from "../../helpers/sql";

/**
 * ADM-16 Part C audit payload scan. TypeScript writers pass payloads through
 * redactSensitive (tests/unit/audit/redact.test.ts). SQL functions write
 * their own audit_logs rows, so they must never name a credential-like key.
 */
const AUDIT_LOG_INSERT = /insert\s+into\s+public\.audit_logs\b/i;
const CREDENTIAL_LITERAL = /'[a-z_.]*(password|token|secret)[a-z_.]*'/gi;

describe("audit payloads written by SQL", () => {
  const audited = migrationFunctionBodies().filter(({ body }) => AUDIT_LOG_INSERT.test(body));

  it("finds the audited SQL functions", () => {
    expect(audited.length).toBeGreaterThanOrEqual(20);
  });

  it("never names a password, token, or secret key", () => {
    const offending = audited.flatMap(({ file, name, body }) =>
      [...body.matchAll(CREDENTIAL_LITERAL)].map((match) => `${file}: ${name}: ${match[0]}`),
    );
    expect(offending).toEqual([]);
  });
});
