// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Department,
  DoctorSummary,
  Specialty,
} from "@/lib/directory/types";
import {
  listBookableDoctors,
  type DirectoryStore,
} from "@/server/directory/service";

vi.mock("server-only", () => ({}));

const CARDIOLOGY: Department = {
  id: "00000000-0000-4000-8000-000000000501",
  name: "Cardiology",
  code: "CARD",
  description: null,
  isActive: true,
};
const CLOSED_WARD: Department = {
  id: "00000000-0000-4000-8000-000000000509",
  name: "Closed Ward",
  code: "CW",
  description: null,
  isActive: false,
};
const INTERNAL_MEDICINE: Specialty = {
  id: "00000000-0000-4000-8000-000000000701",
  name: "Internal Medicine",
  description: null,
  isActive: true,
};
const CARDIO_SPECIALTY: Specialty = {
  id: "00000000-0000-4000-8000-000000000702",
  name: "Cardiology",
  description: null,
  isActive: true,
};
const RETIRED_SPECIALTY: Specialty = {
  id: "00000000-0000-4000-8000-000000000709",
  name: "Retired",
  description: null,
  isActive: false,
};
const EXISTING_DOCTOR: DoctorSummary = {
  id: "00000000-0000-4000-8000-000000000101",
  fullName: "Dr. Paolo Reyes",
  departmentId: CARDIOLOGY.id,
  departmentName: "Cardiology",
  isActive: true,
  specialties: [{ id: INTERNAL_MEDICINE.id, name: "Internal Medicine" }],
};

function createStore(overrides: Partial<DirectoryStore> = {}): DirectoryStore {
  return {
    listDepartments: vi.fn().mockResolvedValue([CARDIOLOGY, CLOSED_WARD]),
    listSpecialties: vi
      .fn()
      .mockResolvedValue([INTERNAL_MEDICINE, CARDIO_SPECIALTY, RETIRED_SPECIALTY]),
    listDoctors: vi.fn().mockResolvedValue([EXISTING_DOCTOR]),
    getDoctor: vi.fn().mockResolvedValue(EXISTING_DOCTOR),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listBookableDoctors", () => {
  it("lists only active doctors, filtered by specialty", async () => {
    const store = createStore();

    await listBookableDoctors({ specialtyId: CARDIO_SPECIALTY.id }, store);

    expect(store.listDoctors).toHaveBeenCalledWith({
      specialtyId: CARDIO_SPECIALTY.id,
      departmentId: undefined,
      activeOnly: true,
    });
  });

  it("lists only active doctors, filtered by department", async () => {
    const store = createStore();

    await listBookableDoctors({ departmentId: CARDIOLOGY.id }, store);

    expect(store.listDoctors).toHaveBeenCalledWith({
      specialtyId: undefined,
      departmentId: CARDIOLOGY.id,
      activeOnly: true,
    });
  });
});
