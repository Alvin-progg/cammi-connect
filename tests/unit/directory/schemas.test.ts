import { describe, expect, it } from "vitest";

import {
  departmentSchema,
  doctorSchema,
  specialtySchema,
} from "@/lib/directory/schemas";

const DEPARTMENT_ID = "00000000-0000-4000-8000-000000000501";
const SPECIALTY_A = "00000000-0000-4000-8000-000000000701";
const SPECIALTY_B = "00000000-0000-4000-8000-000000000702";
const PROFILE_ID = "00000000-0000-4000-8000-000000000001";

function firstMessage(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message;
}

describe("departmentSchema", () => {
  it("trims values, upper-cases the code, and nulls a blank description", () => {
    expect(
      departmentSchema.parse({
        name: "  Cardiology ",
        code: " card ",
        description: "",
        isActive: true,
      }),
    ).toEqual({
      name: "Cardiology",
      code: "CARD",
      description: null,
      isActive: true,
    });
  });

  it("requires a name and a short code", () => {
    expect(
      firstMessage(
        departmentSchema.safeParse({ name: " ", code: "CARD", isActive: true }),
      ),
    ).toBe("Enter a department name.");
    expect(
      firstMessage(
        departmentSchema.safeParse({
          name: "Cardiology",
          code: "CARDIOLOGY-OPD",
          isActive: true,
        }),
      ),
    ).toBe("Keep the code to 10 characters or fewer.");
  });
});

describe("specialtySchema", () => {
  it("parses a specialty with an optional description", () => {
    expect(
      specialtySchema.parse({
        name: "Pediatric Cardiology",
        description: "Heart conditions in children",
        isActive: false,
      }),
    ).toEqual({
      name: "Pediatric Cardiology",
      description: "Heart conditions in children",
      isActive: false,
    });
  });

  it("requires a name", () => {
    expect(
      firstMessage(specialtySchema.safeParse({ name: "", isActive: true })),
    ).toBe("Enter a specialty name.");
  });
});

describe("doctorSchema", () => {
  it("accepts several specialties and an optional linked account", () => {
    expect(
      doctorSchema.parse({
        profileId: PROFILE_ID,
        fullName: " Dr. Ana Cruz ",
        departmentId: DEPARTMENT_ID,
        specialtyIds: [SPECIALTY_A, SPECIALTY_B],
        isActive: true,
      }),
    ).toEqual({
      profileId: PROFILE_ID,
      fullName: "Dr. Ana Cruz",
      departmentId: DEPARTMENT_ID,
      specialtyIds: [SPECIALTY_A, SPECIALTY_B],
      isActive: true,
    });
  });

  it("treats blank account and department as not set", () => {
    expect(
      doctorSchema.parse({
        profileId: "",
        fullName: "Dr. Ana Cruz",
        departmentId: "",
        specialtyIds: [SPECIALTY_A],
        isActive: true,
      }),
    ).toMatchObject({ profileId: null, departmentId: null });
  });

  it("removes duplicate specialties", () => {
    expect(
      doctorSchema.parse({
        fullName: "Dr. Ana Cruz",
        specialtyIds: [SPECIALTY_A, SPECIALTY_A],
        isActive: true,
      }).specialtyIds,
    ).toEqual([SPECIALTY_A]);
  });

  it("requires at least one specialty", () => {
    expect(
      firstMessage(
        doctorSchema.safeParse({
          fullName: "Dr. Ana Cruz",
          specialtyIds: [],
          isActive: true,
        }),
      ),
    ).toBe("Choose at least one specialty.");
  });
});
