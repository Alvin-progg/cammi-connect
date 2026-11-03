import { z } from "zod";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A UUID search param (doctor, department, specialty), or null when absent or malformed. */
export function parseRecordIdParam(
  value: string | string[] | undefined,
): string | null {
  const parsed = z.uuid().safeParse(firstValue(value));
  return parsed.success ? parsed.data : null;
}
