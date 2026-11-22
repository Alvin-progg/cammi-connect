import { describe, expect, it } from "vitest";

import {
  accreditationSaveSchema,
  appointmentHmoUpdateSchema,
  benefitDecisionSchema,
  hmoSubmissionSchema,
  pwdSubmissionSchema,
} from "@/lib/benefits/schemas";

const PROVIDER_ID = "11111111-1111-4111-8111-111111111111";
const DOCTOR_ID = "22222222-2222-4222-8222-222222222222";

describe("pwdSubmissionSchema", () => {
  it("trims the ID number", () => {
    expect(pwdSubmissionSchema.parse({ idNumber: "  PWD-0042  " }).idNumber).toBe("PWD-0042");
  });

  it("rejects a blank or over-long ID number", () => {
    expect(pwdSubmissionSchema.safeParse({ idNumber: "   " }).success).toBe(false);
    expect(pwdSubmissionSchema.safeParse({ idNumber: "x".repeat(51) }).success).toBe(false);
  });
});

describe("hmoSubmissionSchema", () => {
  it("accepts a provider and a membership number", () => {
    const parsed = hmoSubmissionSchema.parse({ providerId: PROVIDER_ID, membershipNumber: " MX-1234 " });
    expect(parsed).toEqual({ providerId: PROVIDER_ID, membershipNumber: "MX-1234" });
  });

  it("rejects a non-UUID provider and an empty membership number", () => {
    expect(hmoSubmissionSchema.safeParse({ providerId: "nope", membershipNumber: "1" }).success).toBe(false);
    expect(hmoSubmissionSchema.safeParse({ providerId: PROVIDER_ID, membershipNumber: "" }).success).toBe(false);
  });
});

describe("benefitDecisionSchema", () => {
  it("accepts a verify without a reason", () => {
    expect(benefitDecisionSchema.parse({ decision: "verify" })).toEqual({ decision: "verify", reason: null });
  });

  it("requires a reason to reject", () => {
    expect(benefitDecisionSchema.safeParse({ decision: "reject", reason: "  " }).success).toBe(false);
    expect(
      benefitDecisionSchema.parse({ decision: "reject", reason: "ID photo is unreadable" }).reason,
    ).toBe("ID photo is unreadable");
  });

  it("rejects any other decision", () => {
    expect(benefitDecisionSchema.safeParse({ decision: "approve" }).success).toBe(false);
  });
});

describe("accreditationSaveSchema", () => {
  const base = {
    doctorId: DOCTOR_ID,
    providerId: PROVIDER_ID,
    status: "active",
    validFrom: "2026-01-01",
    validUntil: "",
  };

  it("treats an empty valid-until as open-ended", () => {
    expect(accreditationSaveSchema.parse(base).validUntil).toBeNull();
  });

  it("refuses valid-until before valid-from", () => {
    const result = accreditationSaveSchema.safeParse({ ...base, validUntil: "2025-12-31" });
    expect(result.success).toBe(false);
  });

  it("accepts only the five accreditation statuses", () => {
    expect(accreditationSaveSchema.safeParse({ ...base, status: "approved" }).success).toBe(false);
  });

  it("requires YYYY-MM-DD dates", () => {
    expect(accreditationSaveSchema.safeParse({ ...base, validFrom: "01/01/2026" }).success).toBe(false);
  });
});

describe("appointmentHmoUpdateSchema", () => {
  it("accepts independent authorization and coverage values", () => {
    const parsed = appointmentHmoUpdateSchema.parse({
      authorization: "approved",
      coverage: "partially_covered",
      loaNumber: "LOA-778",
      remarks: "",
    });
    expect(parsed).toEqual({
      authorization: "approved",
      coverage: "partially_covered",
      loaNumber: "LOA-778",
      remarks: null,
    });
  });

  it("rejects unknown authorization or coverage values", () => {
    expect(
      appointmentHmoUpdateSchema.safeParse({ authorization: "maybe", coverage: "covered" }).success,
    ).toBe(false);
    expect(
      appointmentHmoUpdateSchema.safeParse({ authorization: "pending", coverage: "fully_covered" }).success,
    ).toBe(false);
  });
});
