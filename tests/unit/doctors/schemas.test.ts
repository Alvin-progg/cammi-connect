import { describe, expect, it } from "vitest";

import { doctorFormSchema } from "@/lib/doctors/schemas";

const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000501";
const SPECIALTY_A = "00000000-0000-4000-8000-000000000701";
const SPECIALTY_B = "00000000-0000-4000-8000-000000000702";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000011";

const VALID = {
  fullName: "Dr. Ana Cruz",
  departmentId: DEPARTMENT_ID,
  specialtyIds: [SPECIALTY_A],
  contactEmail: "",
  contactPhone: "",
  bio: "",
  accountProfileId: "",
};

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("doctorFormSchema", () => {
  it("trims values, removes duplicate specialties, and nulls blank optional fields", () => {
    expect(
      doctorFormSchema.parse({
        ...VALID,
        fullName: "  Dr. Ana Cruz ",
        specialtyIds: [SPECIALTY_A, SPECIALTY_B, SPECIALTY_A],
        contactEmail: " ana.cruz@example.test ",
        contactPhone: " 0917 000 0000 ",
        bio: "  Heart specialist. ",
        accountProfileId: ACCOUNT_ID,
      }),
    ).toEqual({
      fullName: "Dr. Ana Cruz",
      departmentId: DEPARTMENT_ID,
      specialtyIds: [SPECIALTY_A, SPECIALTY_B],
      contactEmail: "ana.cruz@example.test",
      contactPhone: "0917 000 0000",
      bio: "Heart specialist.",
      accountProfileId: ACCOUNT_ID,
    });
    expect(doctorFormSchema.parse(VALID)).toMatchObject({
      contactEmail: null,
      contactPhone: null,
      bio: null,
      accountProfileId: null,
    });
  });

  it("requires at least one specialty", () => {
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, specialtyIds: [] }))).toBe(
      "Choose at least one specialty.",
    );
  });

  it("requires a valid department", () => {
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, departmentId: "" }))).toBe(
      "Choose a department.",
    );
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, departmentId: "cardiology" }))).toBe(
      "Choose a department.",
    );
  });

  it("requires a full name of 2 to 120 characters", () => {
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, fullName: " " }))).toBe(
      "Enter the doctor's full name.",
    );
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, fullName: "x".repeat(121) }))).toBe(
      "Keep the name under 120 characters.",
    );
  });

  it("checks the contact email and the length of the contact and bio fields", () => {
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, contactEmail: "not-an-email" }))).toBe(
      "Enter a valid email address.",
    );
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, contactPhone: "1".repeat(41) }))).toBe(
      "Keep the phone number under 40 characters.",
    );
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, bio: "x".repeat(1001) }))).toBe(
      "Keep the bio under 1000 characters.",
    );
  });

  it("rejects a malformed linked account", () => {
    expect(firstMessage(doctorFormSchema.safeParse({ ...VALID, accountProfileId: "someone" }))).toBe(
      "Choose a valid account.",
    );
  });

  it("has no active flag: status changes are a separate action", () => {
    expect(doctorFormSchema.parse({ ...VALID, isActive: false })).not.toHaveProperty("isActive");
  });
});
