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
      category: "other",
      priceCentavos: null,
      vatable: false,
      philhealthBenefitCentavos: 0,
      hmoCoverable: false,
      requiresDoctorRequest: false,
      dailyCapacity: null,
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
    ).toMatchObject({
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

  it("reads PAY-01 pricing: pesos become integer centavos, checkboxes become booleans", () => {
    expect(
      serviceFormSchema.parse({
        name: "Whole abdomen ultrasound",
        bookingMode: "scheduled",
        category: "imaging",
        priceCentavos: "1,500.00",
        vatable: "on",
        philhealthBenefitCentavos: "500",
        hmoCoverable: "on",
        requiresDoctorRequest: "on",
        dailyCapacity: "",
      }),
    ).toMatchObject({
      bookingMode: "scheduled",
      category: "imaging",
      priceCentavos: 150000,
      vatable: true,
      philhealthBenefitCentavos: 50000,
      hmoCoverable: true,
      requiresDoctorRequest: true,
      dailyCapacity: null,
    });
  });

  it("treats a blank price as price on request and a blank PhilHealth benefit as none", () => {
    expect(
      serviceFormSchema.parse({ name: "CT scan", priceCentavos: " ", philhealthBenefitCentavos: "" }),
    ).toMatchObject({ priceCentavos: null, philhealthBenefitCentavos: 0 });
  });

  it("rejects negative or malformed prices", () => {
    const message = "Enter the price in pesos, like 1500 or 1500.50.";
    expect(firstMessage(serviceFormSchema.safeParse({ name: "CBC", priceCentavos: "-250" }))).toBe(message);
    expect(firstMessage(serviceFormSchema.safeParse({ name: "CBC", priceCentavos: "2.505" }))).toBe(message);
    expect(
      firstMessage(serviceFormSchema.safeParse({ name: "CBC", philhealthBenefitCentavos: "-1" })),
    ).toBe("Enter the PhilHealth benefit in pesos, like 500 or 500.50.");
  });

  it("only allows the known categories and a positive whole daily capacity", () => {
    expect(
      firstMessage(serviceFormSchema.safeParse({ name: "CBC", category: "pharmacy" })),
    ).toBe("Choose a category.");
    expect(serviceFormSchema.parse({ name: "CBC", dailyCapacity: "40" }).dailyCapacity).toBe(40);
    for (const capacity of ["0", "-3", "2.5", "many"]) {
      expect(
        firstMessage(serviceFormSchema.safeParse({ name: "CBC", dailyCapacity: capacity })),
        capacity,
      ).toBe("Enter a daily capacity from 1 to 1000, or leave it blank.");
    }
  });
});
