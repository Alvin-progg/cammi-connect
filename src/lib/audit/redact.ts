/** A JSON-serialisable audit payload value. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Key names whose values must never reach the audit log. */
const SENSITIVE_KEY = /password|token|secret|key/i;

/**
 * Returns a copy of an audit payload without any key that looks like a
 * credential, at any depth. Matching is by substring, so `apiKey`,
 * `access_token`, and `clientSecret` are all removed.
 */
export function redactSensitive(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, nested]) => [key, redactSensitive(nested)]),
    );
  }
  return value;
}
