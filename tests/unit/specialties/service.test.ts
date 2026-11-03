// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Specialty } from "@/lib/directory/types";
import {
  getSpecialtyDetail,
  listSpecialtiesOverview,
  saveSpecialty,
  setSpecialtyActive,
  type SpecialtyAdminStore,
} from "@/server/specialties/service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const CARDIOLOGY_ID = "00000000-0000-4000-8000-000000000701";
const PEDIATRICS_ID = "00000000-0000-4000-8000-000000000702";

const CARDIOLOGY: Specialty = { id: CARDIOLOGY_ID, name: "Cardiology", description: null, isActive: true };
const PEDIATRICS: Specialty = { ...CARDIOLOGY, id: PEDIATRICS_ID, name: "Pediatrics" };

function fakeStore() {
  return {
    listSpecialties: vi.fn().mockResolvedValue([CARDIOLOGY, PEDIATRICS]),
    countDoctorsBySpecialty: vi.fn().mockResolvedValue(new Map([[CARDIOLOGY_ID, 3]])),
    getSpecialty: vi.fn().mockResolvedValue(CARDIOLOGY),
    listDoctors: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({ ok: true, specialtyId: CARDIOLOGY_ID }),
    setActive: vi.fn().mockResolvedValue({ ok: true }),
  } satisfies SpecialtyAdminStore;
}

let store: ReturnType<typeof fakeStore>;

beforeEach(() => {
  store = fakeStore();
});

describe("listSpecialtiesOverview", () => {
  it("adds the number of doctors per specialty", async () => {
    await expect(listSpecialtiesOverview(store)).resolves.toEqual([
      { ...CARDIOLOGY, doctorCount: 3 },
      { ...PEDIATRICS, doctorCount: 0 },
    ]);
  });
});

describe("getSpecialtyDetail", () => {
  it("returns the specialty and every doctor who has it", async () => {
    await expect(getSpecialtyDetail(CARDIOLOGY_ID, store)).resolves.toEqual({
      specialty: CARDIOLOGY,
      doctors: [],
    });
    expect(store.listDoctors).toHaveBeenCalledWith(CARDIOLOGY_ID);
  });

  it("returns null for a missing specialty", async () => {
    store.getSpecialty.mockResolvedValue(null);
    await expect(getSpecialtyDetail(CARDIOLOGY_ID, store)).resolves.toBeNull();
    expect(store.listDoctors).not.toHaveBeenCalled();
  });
});

describe("saveSpecialty", () => {
  const INPUT = { name: "Cardiology", description: null };

  it("saves as the acting admin and returns the specialty id", async () => {
    await expect(
      saveSpecialty({ actorId: ADMIN_ID, specialtyId: null, input: INPUT }, store),
    ).resolves.toEqual({ ok: true, specialtyId: CARDIOLOGY_ID, message: "Specialty saved." });
    expect(store.save).toHaveBeenCalledWith({ actorId: ADMIN_ID, specialtyId: null, ...INPUT });
  });

  it("explains a duplicate name, including one that differs only by case", async () => {
    store.save.mockResolvedValue({ ok: false, code: "duplicate" });

    await expect(
      saveSpecialty({ actorId: ADMIN_ID, specialtyId: null, input: { name: "cardiology", description: null } }, store),
    ).resolves.toEqual({ ok: false, message: "A specialty with that name already exists." });
  });

  it("uses a generic message for an unexpected database error", async () => {
    store.save.mockResolvedValue({ ok: false, code: undefined });

    await expect(
      saveSpecialty({ actorId: ADMIN_ID, specialtyId: CARDIOLOGY_ID, input: INPUT }, store),
    ).resolves.toEqual({ ok: false, message: "Something went wrong. Try again." });
  });
});

describe("setSpecialtyActive", () => {
  it.each([
    [false, "Specialty deactivated."],
    [true, "Specialty activated."],
  ])("sets isActive=%s as the acting admin", async (isActive, message) => {
    await expect(
      setSpecialtyActive({ actorId: ADMIN_ID, specialtyId: CARDIOLOGY_ID, isActive }, store),
    ).resolves.toEqual({ ok: true, message });
    expect(store.setActive).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      specialtyId: CARDIOLOGY_ID,
      isActive,
    });
  });

  it("maps a database refusal to its message", async () => {
    store.setActive.mockResolvedValue({ ok: false, code: "unchanged" });

    await expect(
      setSpecialtyActive({ actorId: ADMIN_ID, specialtyId: CARDIOLOGY_ID, isActive: false }, store),
    ).resolves.toEqual({ ok: false, message: "Nothing to change." });
  });
});
