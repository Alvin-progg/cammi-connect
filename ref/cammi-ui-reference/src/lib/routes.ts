/**
 * The reference app uses hash routing so it runs as static files. Paths are
 * the repo's real routes; in Next.js swap `href(path)` for `<Link href={path}>`.
 */
export function href(path: string): string {
  return `#${path}`;
}
