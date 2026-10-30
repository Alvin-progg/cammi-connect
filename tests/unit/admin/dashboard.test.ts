import { describe, expect, it } from "vitest";

import { parseAdminView, parseRecordIdParam } from "@/lib/admin/dashboard";

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";

describe("parseAdminView", () => {
  it("defaults to the doctors view", () => {
    expect(parseAdminView(undefined)).toBe("doctors");
    expect(parseAdminView("unknown")).toBe("doctors");
  });

  it("accepts each admin view, taking the first repeated value", () => {
    expect(parseAdminView("departments")).toBe("departments");
    expect(parseAdminView("specialties")).toBe("specialties");
    expect(parseAdminView(["schedule", "doctors"])).toBe("schedule");
  });
});

describe("parseRecordIdParam", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(parseRecordIdParam(DOCTOR_ID)).toBe(DOCTOR_ID);
    expect(parseRecordIdParam([DOCTOR_ID])).toBe(DOCTOR_ID);
    expect(parseRecordIdParam("not-a-uuid")).toBeNull();
    expect(parseRecordIdParam(undefined)).toBeNull();
  });
});
