// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { Department, DoctorSummary, Specialty } from "@/lib/directory/types";
import { createChatTools } from "@/server/chat/tools";
import type { DirectoryStore } from "@/server/directory/service";

vi.mock("server-only", () => ({}));

const DEPARTMENTS: Department[] = [
  { id: "dep1", name: "Cardiology", code: "CARD", description: null, isActive: true },
  { id: "dep2", name: "Closed Wing", code: "CLSD", description: null, isActive: false },
];
const SPECIALTIES: Specialty[] = [
  { id: "sp1", name: "Interventional Cardiology", description: null, isActive: true },
  { id: "sp2", name: "Retired Specialty", description: null, isActive: false },
];
const MAYA: DoctorSummary = {
  id: "d1",
  fullName: "Maya Santos",
  departmentId: "dep1",
  departmentName: "Cardiology",
  isActive: true,
  specialties: [{ id: "sp1", name: "Interventional Cardiology" }],
};
const JOSE: DoctorSummary = { ...MAYA, id: "d2", fullName: "José Santos" };

function fakeStore(): DirectoryStore {
  return {
    listDepartments: vi.fn(async () => DEPARTMENTS),
    listSpecialties: vi.fn(async () => SPECIALTIES),
    listDoctors: vi.fn(async () => [MAYA, JOSE]),
    getDoctor: vi.fn(),
    saveDepartment: vi.fn(),
    saveSpecialty: vi.fn(),
    saveDoctor: vi.fn(),
    listLinkableAccounts: vi.fn(),
  };
}

describe("chat directory tools", () => {
  it("returns active departments only", async () => {
    const tools = createChatTools(fakeStore());

    expect(await tools.getDepartments()).toEqual([DEPARTMENTS[0]]);
  });

  it("returns active specialties only", async () => {
    const tools = createChatTools(fakeStore());

    expect(await tools.getSpecialties()).toEqual([SPECIALTIES[0]]);
  });

  it("looks doctors up among active doctors only", async () => {
    const store = fakeStore();
    const tools = createChatTools(store);

    await tools.getDoctorDetails({ doctorName: "Maya Santos" });

    expect(store.listDoctors).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: true }));
  });

  it("finds one doctor by name", async () => {
    const tools = createChatTools(fakeStore());

    expect(await tools.getDoctorDetails({ doctorName: "Dr. Maya Santos" })).toEqual({
      status: "found",
      doctor: MAYA,
    });
  });

  it("returns every match when the name is ambiguous", async () => {
    const tools = createChatTools(fakeStore());

    expect(await tools.getDoctorDetails({ doctorName: "Dr. Santos" })).toEqual({
      status: "several",
      doctors: [MAYA, JOSE],
    });
  });

  it("reports an unknown doctor", async () => {
    const tools = createChatTools(fakeStore());

    expect(await tools.getDoctorDetails({ doctorName: "Dr. House" })).toEqual({
      status: "unknown",
    });
  });

  it("rejects an invalid name before querying", async () => {
    const store = fakeStore();
    const tools = createChatTools(store);

    await expect(tools.getDoctorDetails({ doctorName: "   " })).rejects.toThrow();
    await expect(tools.getDoctorDetails({ doctorName: "x".repeat(201) })).rejects.toThrow();
    expect(store.listDoctors).not.toHaveBeenCalled();
  });
});
