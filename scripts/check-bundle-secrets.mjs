#!/usr/bin/env node
/**
 * Client bundle secret scan (ADM-16, spec §18).
 *
 * Run after `npm run build` with: npm run check:bundle
 * Reads .env.local when present. Searches every file under .next/static (the
 * code browsers download) for the values of the server-only secrets and for
 * their variable names. Prints only pass/fail lines and file paths, never a
 * secret value. Exits 1 on any finding, 2 when there is no build to scan.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = join(process.cwd(), ".next", "static");
const SECRET_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "SEED_ADMIN_PASSWORD",
  "SEED_DOCTOR_PASSWORD",
  "SEED_FRONT_DESK_PASSWORD",
];
// Shorter values would match by chance; real keys are far longer.
const MIN_VALUE_LENGTH = 12;

if (!existsSync(STATIC_DIR)) {
  console.error("FAIL  no .next/static directory; run `npm run build` first.");
  process.exit(2);
}

const files = readdirSync(STATIC_DIR, { recursive: true, encoding: "utf8" })
  .map((file) => join(STATIC_DIR, file))
  .filter((path) => /\.(js|mjs|css|html|json|txt|map)$/.test(path));

const needles = [];
for (const name of SECRET_NAMES) {
  needles.push({ label: `${name} (name)`, text: name });
  const value = process.env[name];
  if (value && value.length >= MIN_VALUE_LENGTH) {
    needles.push({ label: `${name} (value)`, text: value });
  } else {
    console.log(`SKIP  ${name} value: not set, or too short to scan for`);
  }
}

let findings = 0;
for (const path of files) {
  const content = readFileSync(path, "utf8");
  for (const needle of needles) {
    if (content.includes(needle.text)) {
      findings += 1;
      console.error(`FAIL  ${needle.label} found in ${path}`);
    }
  }
}

if (findings > 0) {
  process.exit(1);
}
console.log(`PASS  ${files.length} client files contain no server secret names or values`);
