// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { functionBodies, MIGRATIONS_DIR } from "../../helpers/sql";

/**
 * PAY-03 (D6 reversed): chat patients cannot pay at the hospital counter.
 * Migration 0043 rejects a counter payment still awaiting payment. Front-desk
 * and HMO-fallback rows use collect_at_counter, which the trigger leaves alone.
 * Static checks only; the trigger is smoke-tested against a local DB (db/README.md).
 */
const MIGRATION_PATH = join(MIGRATIONS_DIR, "0043_chat_no_counter_payment.sql");

describe("no counter payment in chat migration (0043)", () => {
  const migration = readFileSync(MIGRATION_PATH, "utf8");

  it("rejects a counter payment that is awaiting payment", () => {
    expect(migration).toMatch(/create or replace function public\.cammi_connect_refuse_chat_counter_payment\(\)/);
    expect(migration).toMatch(/new\.method = 'counter'\s+and new\.status = 'awaiting_payment'/);
    expect(migration).toMatch(/raise exception/);
  });

  it("fires before insert so no new chat counter payment can be stored", () => {
    expect(migration).toMatch(/before insert on public\.payments/);
  });

  it("does not touch collect_at_counter, so front-desk and HMO fallback rows still work", () => {
    const body = functionBodies(migration).find((fn) => fn.name === "cammi_connect_refuse_chat_counter_payment")?.body ?? "";
    expect(body).not.toBe("");
    expect(body).not.toMatch(/collect_at_counter/);
    expect(migration).not.toMatch(/before update/);
  });
});
