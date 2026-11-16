// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * SPEC §7.3: no chat content or patient health details in logs. Server code
 * logs fixed strings only. The one exception is the chat route's structured
 * line and the receipt route's (PAY-04), which their handlers build from
 * request IDs and outcomes (their tests check that message text, amounts,
 * and references never reach `log`).
 */

const SRC = join(process.cwd(), "src");
const CONSOLE_CALL = /console\.(?:log|info|warn|error|debug)\(([^)]*)\)/g;
const STRING_LITERAL = /^\s*(["'`])(?:(?!\1|\$\{)[^\\]|\\.)*\1\s*$/;
const ALLOWED = new Set([
  join("app", "api", "v1", "chat", "route.ts") + ": line",
  join("app", "api", "v1", "payments", "[id]", "receipt", "route.ts") + ": line",
]);

describe("console logging", () => {
  it("logs only fixed strings, never variables that could carry patient data", () => {
    const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((file) =>
      /\.(ts|tsx)$/.test(file),
    );
    const offenders = files.flatMap((file) =>
      [...readFileSync(join(SRC, file), "utf8").matchAll(CONSOLE_CALL)]
        .map((match) => `${file}: ${match[1].trim()}`)
        .filter((call) => !STRING_LITERAL.test(call.slice(call.indexOf(": ") + 2)))
        .filter((call) => !ALLOWED.has(call)),
    );

    expect(offenders).toEqual([]);
  });
});
