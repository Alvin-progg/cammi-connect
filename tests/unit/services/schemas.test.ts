import { describe, expect, it } from "vitest";

import { serviceFormSchema } from "@/lib/services/schemas";

const RADIOLOGY_ID = "00000000-0000-4000-8000-000000000301";

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("serviceFormSchema", () => {
  it("trims text, nulls blanks, and defaults to an informational service", () => {
    expect(
      serviceFormSchema.parse({ name: "  X-ray ", description: " ", departmentId: "" }),
    ).toEqual({
      name: "X-ray",
      description: null,
      departmentId: null,
      requiresAppointment: false,
      bookingMode: "none",
    });
  });

  it("accepts a department, the appointment checkbox, and a booking mode", () => {
    expect(
      serviceFormSchema.parse({
        name: "Consultation",
        description: "Outpatient visit",
        departmentId: RADIOLOGY_ID,
        requiresAppointment: "on",
        bookingMode: "doctor_consultation",
      }),
    ).toEqual({
      name: "Consultation",
      description: "Outpatient visit",
      departmentId: RADIOLOGY_ID,
      requiresAppointment: true,
      bookingMode: "doctor_consultation",
    });
  });

  it("requires a name of at most 100 characters", () => {
    expect(firstMessage(serviceFormSchema.safeParse({ name: "" }))).toBe("Enter a service name.");
    expect(firstMessage(serviceFormSchema.safeParse({ name: "x".repeat(101) }))).toBe(
      "Keep the name under 100 characters.",
    );
  });

  it("rejects a malformed department id", () => {
    expect(firstMessage(serviceFormSchema.safeParse({ name: "X-ray", departmentId: "nope" }))).toBe(
      "Choose a valid department.",
    );
  });

  it("only allows the known booking modes", () => {
    expect(
      firstMessage(serviceFormSchema.safeParse({ name: "X-ray", bookingMode: "equipment_slot" })),
    ).toBe("Choose how patients access the service.");
    expect(serviceFormSchema.parse({ name: "Lab", bookingMode: "walk_in" }).bookingMode).toBe(
      "walk_in",
    );
  });

  it("has no active flag: status changes are a separate action", () => {
    expect(serviceFormSchema.parse({ name: "Lab", isActive: false })).not.toHaveProperty("isActive");
  });
});
