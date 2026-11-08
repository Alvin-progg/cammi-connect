import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MIGRATIONS_DIR = join(process.cwd(), "db/migrations");

/** Dollar-quoted bodies ($$...$$ or $tag$...$tag$) with the function name before them. */
export function functionBodies(sql: string): { name: string; body: string }[] {
  const bodies: { name: string; body: string }[] = [];
  const pattern = /\$(\w*)\$([\s\S]*?)\$\1\$/g;
  for (const match of sql.matchAll(pattern)) {
    const preceding = sql.slice(0, match.index);
    const names = [...preceding.matchAll(/create or replace function\s+public\.(\w+)/gi)];
    bodies.push({ name: names.at(-1)?.[1] ?? "(anonymous block)", body: match[2] });
  }
  return bodies;
}

/** Every function body in every migration, tagged with its file. */
export function migrationFunctionBodies(): { file: string; name: string; body: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      functionBodies(readFileSync(join(MIGRATIONS_DIR, file), "utf8")).map((fn) => ({ ...fn, file })),
    );
}
