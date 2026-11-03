import { describe, expect, it } from "vitest";

import { parseRecordIdParam } from "@/lib/admin/dashboard";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";

describe("parseRecordIdParam", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(parseRecordIdParam(DOCTOR_ID)).toBe(DOCTOR_ID);
    expect(parseRecordIdParam([DOCTOR_ID])).toBe(DOCTOR_ID);
    expect(parseRecordIdParam("not-a-uuid")).toBeNull();
    expect(parseRecordIdParam(undefined)).toBeNull();
  });
});
