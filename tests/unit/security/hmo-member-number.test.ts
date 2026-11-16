// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * PAY-001 "HMO member numbers are shown masked everywhere except the front
 * desk detail". Only the booking write and the front desk request details
 * read the stored number; chat shows it through maskMemberNumber.
 */
const ROOT = process.cwd();
const ALLOWED = new Set([
  "src/server/db/database.types.ts",
  // A comment naming the column for the chat draft's length limit.
  "src/lib/chat/state.ts",
  // PAY-03 booking: the RPC argument that stores it.
  "src/server/payments/repository.ts",
  // PAY-06: the front desk request details (full number).
  "src/server/front-desk/repository.ts",
]);
const MEMBER_NUMBER_COLUMN = /hmo_member_number/;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => join(dir, file));
}

describe("HMO member number privacy", () => {
  it("reads the stored member number only in the booking write and the front desk details", () => {
    const readers = sourceFiles("src").filter((file) =>
      MEMBER_NUMBER_COLUMN.test(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(readers.filter((file) => !ALLOWED.has(file))).toEqual([]);
  });

  it("never selects it for the request queue", () => {
    const repository = readFileSync(join(ROOT, "src/server/front-desk/repository.ts"), "utf8");
    const queue = repository.match(/async function loadPaymentBadges[\s\S]*?\n}\n/)?.[0] ?? "";
    expect(queue).not.toBe("");
    expect(queue).not.toMatch(MEMBER_NUMBER_COLUMN);
  });
});
