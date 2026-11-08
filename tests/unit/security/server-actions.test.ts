// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ADM-16 Part C: every exported Server Action resolves a session before doing
 * anything, so authorization never depends on the UI. A function counts as
 * guarded when it calls a session guard from src/server/auth/dal.ts, or calls
 * a function in the same file that is guarded (followed to a fixed point).
 */
const DAL_GUARDS = [
  "getAdminSession",
  "getDoctorSession",
  "getFrontDeskSession",
  "getPatientSession",
  "requireUser",
];

/** Deliberately public actions, each with the reason it needs no session guard. */
const PUBLIC_ACTIONS: Record<string, string> = {
  "auth/actions.ts:loginAction": "signs a visitor in",
  "auth/actions.ts:registerAction": "creates a patient account; roles never come from registration",
  "auth/actions.ts:updatePasswordAction": "needs the invite/reset session itself (getUser)",
  "auth/actions.ts:signOutAction": "only ends the caller's own session",
};

const SERVER_DIR = join(process.cwd(), "src/server");

/** Top-level declarations and their text up to the next top-level declaration. */
function topLevelDeclarations(source: string): { name: string; exported: boolean; body: string }[] {
  const pattern =
    /^(export\s+)?(?:(?:async\s+)?function\s+(\w+)|const\s+(\w+)\s*=)/gm;
  const matches = [...source.matchAll(pattern)];
  return matches.map((match, index) => ({
    name: match[2] ?? match[3],
    exported: Boolean(match[1]),
    body: source.slice(match.index, matches[index + 1]?.index ?? source.length),
  }));
}

function guardedNames(declarations: { name: string; body: string }[]): Set<string> {
  const guarded = new Set<string>();
  const callsAny = (body: string, names: Iterable<string>) =>
    [...names].some((name) => new RegExp(`\\b${name}\\(`).test(body));

  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (guarded.has(declaration.name)) continue;
      // Skip the declaration's own name so recursion doesn't count as a guard.
      const body = declaration.body.slice(declaration.body.indexOf(declaration.name) + declaration.name.length);
      if (callsAny(body, DAL_GUARDS) || callsAny(body, guarded)) {
        guarded.add(declaration.name);
        changed = true;
      }
    }
  }
  return guarded;
}

const actionFiles = readdirSync(SERVER_DIR, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".ts"))
  .filter((file) => /^\s*["']use server["']/.test(readFileSync(join(SERVER_DIR, file), "utf8")));

describe("server action guards", () => {
  it("tells guarded from unguarded exports (self-check)", () => {
    const source = [
      'async function requireActor() { return getAdminSession("/admin"); }',
      "export async function guardedAction() { await requireActor(); }",
      "function factory() { return async () => requireActor(); }",
      'export const viaFactory = factory();',
      "export async function openAction() { return 1; }",
    ].join("\n");
    const declarations = topLevelDeclarations(source);
    const guarded = guardedNames(declarations);

    expect(declarations.filter((d) => d.exported && !guarded.has(d.name)).map((d) => d.name)).toEqual([
      "openAction",
    ]);
  });

  it("finds the Server Action files", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(14);
  });

  it("checks a session in every exported Server Action", () => {
    const unguarded: string[] = [];
    for (const file of actionFiles) {
      const declarations = topLevelDeclarations(readFileSync(join(SERVER_DIR, file), "utf8"));
      const guarded = guardedNames(declarations);
      for (const declaration of declarations) {
        const id = `${file}:${declaration.name}`;
        if (declaration.exported && !guarded.has(declaration.name) && !(id in PUBLIC_ACTIONS)) {
          unguarded.push(id);
        }
      }
    }

    expect(unguarded).toEqual([]);
  });

  it("keeps the public allow-list current", () => {
    const stale = Object.keys(PUBLIC_ACTIONS).filter((id) => {
      const [file, name] = id.split(":");
      const path = join(SERVER_DIR, file);
      return !readFileSync(path, "utf8").includes(`function ${name}(`);
    });
    expect(stale).toEqual([]);
  });
});
