// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Department } from "@/lib/directory/types";
import {
  getDepartmentDetail,
  listDepartmentsOverview,
  saveDepartment,
  setDepartmentActive,
  type DepartmentAdminStore,
} from "@/server/departments/service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const CARDIOLOGY_ID = "00000000-0000-4000-8000-000000000501";
const PEDIATRICS_ID = "00000000-0000-4000-8000-000000000502";
const NOW = new Date("2026-11-03T04:00:00Z");

const CARDIOLOGY: Department = {
  id: CARDIOLOGY_ID,
  name: "Cardiology",
  code: "CARD",
  description: null,
  isActive: true,
};
const PEDIATRICS: Department = { ...CARDIOLOGY, id: PEDIATRICS_ID, name: "Pediatrics", code: "PED" };

const CONFLICT = {
  appointmentId: "00000000-0000-4000-8000-000000000201",
  scheduledAt: "2026-11-10T01:00:00Z",
  status: "confirmed" as const,
  doctorName: "Dr. Maya Santos",
};

function fakeStore() {
  return {
    listDepartments: vi.fn().mockResolvedValue([CARDIOLOGY, PEDIATRICS]),
    countDoctorsByDepartment: vi.fn().mockResolvedValue(new Map([[CARDIOLOGY_ID, 2]])),
    listAppointmentStats: vi.fn().mockResolvedValue([
      { departmentId: CARDIOLOGY_ID, status: "completed", count: 4 },
      { departmentId: CARDIOLOGY_ID, status: "no_show", count: 1 },
    ]),
    getDepartment: vi.fn().mockResolvedValue(CARDIOLOGY),
    listDoctors: vi.fn().mockResolvedValue([]),
    listFutureConflicts: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({ ok: true, departmentId: CARDIOLOGY_ID }),
    setActive: vi.fn().mockResolvedValue({ ok: true }),
  } satisfies DepartmentAdminStore;
}

let store: ReturnType<typeof fakeStore>;

beforeEach(() => {
  store = fakeStore();
});

describe("listDepartmentsOverview", () => {
  it("adds doctor counts and appointments from the last 30 days", async () => {
    await expect(listDepartmentsOverview(store, NOW)).resolves.toEqual([
      { ...CARDIOLOGY, doctorCount: 2, recentAppointmentCount: 5 },
      { ...PEDIATRICS, doctorCount: 0, recentAppointmentCount: 0 },
    ]);
    expect(store.listAppointmentStats).toHaveBeenCalledWith({
      from: new Date("2026-10-04T04:00:00Z"),
      to: NOW,
    });
  });
});

describe("getDepartmentDetail", () => {
  it("returns the department, its doctors, and 30-day counts by status", async () => {
    await expect(getDepartmentDetail(CARDIOLOGY_ID, store, NOW)).resolves.toEqual({
      department: CARDIOLOGY,
      doctors: [],
      statusCounts: { completed: 4, no_show: 1 },
    });
    expect(store.listDoctors).toHaveBeenCalledWith(CARDIOLOGY_ID);
  });

  it("returns null for a missing department", async () => {
    store.getDepartment.mockResolvedValue(null);
    await expect(getDepartmentDetail(CARDIOLOGY_ID, store, NOW)).resolves.toBeNull();
  });
});

describe("saveDepartment", () => {
  const INPUT = { name: "Cardiology", code: "CARD", description: null };

  it("saves as the acting admin and returns the department id", async () => {
    await expect(
      saveDepartment({ actorId: ADMIN_ID, departmentId: null, input: INPUT }, store),
    ).resolves.toEqual({ ok: true, departmentId: CARDIOLOGY_ID, message: "Department saved." });
    expect(store.save).toHaveBeenCalledWith({ actorId: ADMIN_ID, departmentId: null, ...INPUT });
  });

  it("explains a duplicate name or code", async () => {
    store.save.mockResolvedValue({ ok: false, code: "duplicate" });

    await expect(
      saveDepartment({ actorId: ADMIN_ID, departmentId: CARDIOLOGY_ID, input: INPUT }, store),
    ).resolves.toEqual({ ok: false, message: "A department with that name or code already exists." });
  });
});

describe("setDepartmentActive", () => {
  it("refuses to deactivate while future appointments exist, listing them without writing", async () => {
    store.listFutureConflicts.mockResolvedValue([CONFLICT]);

    await expect(
      setDepartmentActive({ actorId: ADMIN_ID, departmentId: CARDIOLOGY_ID, isActive: false }, store),
    ).resolves.toEqual({
      ok: false,
      message: expect.stringContaining("upcoming appointments"),
      conflicts: [CONFLICT],
    });
    expect(store.setActive).not.toHaveBeenCalled();
  });

  it("deactivates when nothing is booked ahead", async () => {
    await expect(
      setDepartmentActive({ actorId: ADMIN_ID, departmentId: CARDIOLOGY_ID, isActive: false }, store),
    ).resolves.toEqual({ ok: true, message: "Department deactivated." });
    expect(store.setActive).toHaveBeenCalledWith({
      actorId: ADMIN_ID,
      departmentId: CARDIOLOGY_ID,
      isActive: false,
    });
  });

  it("activates without checking appointments", async () => {
    await expect(
      setDepartmentActive({ actorId: ADMIN_ID, departmentId: CARDIOLOGY_ID, isActive: true }, store),
    ).resolves.toEqual({ ok: true, message: "Department activated." });
    expect(store.listFutureConflicts).not.toHaveBeenCalled();
  });

  it("lists the conflicts when a booking slipped in before the database check", async () => {
    store.listFutureConflicts.mockResolvedValueOnce([]).mockResolvedValueOnce([CONFLICT]);
    store.setActive.mockResolvedValue({ ok: false, code: "has_future_appointments" });

    await expect(
      setDepartmentActive({ actorId: ADMIN_ID, departmentId: CARDIOLOGY_ID, isActive: false }, store),
    ).resolves.toEqual({
      ok: false,
      message: expect.stringContaining("upcoming appointments"),
      conflicts: [CONFLICT],
    });
  });

  it("maps other database refusals to their messages", async () => {
    store.setActive.mockResolvedValue({ ok: false, code: "not_admin" });

    await expect(
      setDepartmentActive({ actorId: ADMIN_ID, departmentId: CARDIOLOGY_ID, isActive: true }, store),
    ).resolves.toEqual({ ok: false, message: "Only an active administrator can manage departments." });
  });
});
