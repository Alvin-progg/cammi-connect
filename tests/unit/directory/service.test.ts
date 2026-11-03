// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Department,
  DoctorSummary,
  Specialty,
} from "@/lib/directory/types";
import {
  listBookableDoctors,
  saveDoctor,
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
const LINKABLE_PROFILE_ID = "00000000-0000-4000-8000-000000000001";

function createStore(overrides: Partial<DirectoryStore> = {}): DirectoryStore {
  return {
    listDepartments: vi.fn().mockResolvedValue([CARDIOLOGY, CLOSED_WARD]),
    listSpecialties: vi
      .fn()
      .mockResolvedValue([INTERNAL_MEDICINE, CARDIO_SPECIALTY, RETIRED_SPECIALTY]),
    listDoctors: vi.fn().mockResolvedValue([EXISTING_DOCTOR]),
    getDoctor: vi.fn().mockResolvedValue(EXISTING_DOCTOR),
    saveDoctor: vi.fn().mockResolvedValue("saved"),
    listLinkableAccounts: vi
      .fn()
      .mockResolvedValue([
        { profileId: LINKABLE_PROFILE_ID, fullName: "Synthetic Account" },
      ]),
    ...overrides,
  };
}

const NEW_DOCTOR = {
  profileId: null,
  fullName: "Dr. Ana Cruz",
  departmentId: CARDIOLOGY.id,
  specialtyIds: [INTERNAL_MEDICINE.id, CARDIO_SPECIALTY.id],
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveDoctor", () => {
  it("creates a login-less doctor with a department and several specialties", async () => {
    const store = createStore();

    await expect(saveDoctor({ doctorId: null, ...NEW_DOCTOR }, store)).resolves.toEqual({
      ok: true,
    });
    expect(store.saveDoctor).toHaveBeenCalledWith({
      doctorId: null,
      fullName: "Dr. Ana Cruz",
      departmentId: CARDIOLOGY.id,
      specialtyIds: [INTERNAL_MEDICINE.id, CARDIO_SPECIALTY.id],
      isActive: true,
    });
  });

  it("promotes a linkable registered account", async () => {
    const store = createStore();

    await saveDoctor(
      { doctorId: null, ...NEW_DOCTOR, profileId: LINKABLE_PROFILE_ID },
      store,
    );

    expect(store.saveDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: LINKABLE_PROFILE_ID }),
    );
  });

  it("refuses to promote an account that is not linkable", async () => {
    const store = createStore();

    await expect(
      saveDoctor(
        {
          doctorId: null,
          ...NEW_DOCTOR,
          profileId: "00000000-0000-4000-8000-0000000000aa",
        },
        store,
      ),
    ).resolves.toEqual({
      ok: false,
      message: "That account cannot be linked as a doctor.",
    });
    expect(store.saveDoctor).not.toHaveBeenCalled();
  });

  it("updates an existing doctor, including deactivation", async () => {
    const store = createStore();

    await expect(
      saveDoctor(
        { doctorId: EXISTING_DOCTOR.id, ...NEW_DOCTOR, isActive: false },
        store,
      ),
    ).resolves.toEqual({ ok: true });
    expect(store.getDoctor).toHaveBeenCalledWith(EXISTING_DOCTOR.id);
    expect(store.saveDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: EXISTING_DOCTOR.id, isActive: false }),
    );
  });

  it("refuses to update an id that is not an existing doctor", async () => {
    const store = createStore({ getDoctor: vi.fn().mockResolvedValue(null) });

    await expect(
      saveDoctor({ doctorId: LINKABLE_PROFILE_ID, ...NEW_DOCTOR }, store),
    ).resolves.toEqual({ ok: false, message: "That doctor no longer exists." });
    expect(store.saveDoctor).not.toHaveBeenCalled();
  });

  it("rejects an inactive department", async () => {
    const store = createStore();

    await expect(
      saveDoctor(
        { doctorId: null, ...NEW_DOCTOR, departmentId: CLOSED_WARD.id },
        store,
      ),
    ).resolves.toEqual({ ok: false, message: "Choose an active department." });
  });

  it("rejects inactive or unknown specialties", async () => {
    const store = createStore();

    await expect(
      saveDoctor(
        {
          doctorId: null,
          ...NEW_DOCTOR,
          specialtyIds: [INTERNAL_MEDICINE.id, RETIRED_SPECIALTY.id],
        },
        store,
      ),
    ).resolves.toEqual({ ok: false, message: "Choose active specialties only." });
    expect(store.saveDoctor).not.toHaveBeenCalled();
  });
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
