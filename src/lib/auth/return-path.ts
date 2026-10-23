/**
 * Returns a safe same-origin relative path for `?next=` redirects, or an empty
 * string when the value must not be used.
 *
 * Rejects: absolute URLs, protocol-relative (`//`), backslashes, and values
 * with a scheme-like colon. Redirects always default to a known route when the
 * result is empty.
 */
export function sanitizeReturnPath(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("/") || value.startsWith("//")) return "";
  if (value.includes("\\")) return "";
  if (value.includes(":")) return "";
  return value;
}
