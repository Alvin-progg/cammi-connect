// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HospitalService } from "@/lib/services/types";
import {
  getServiceDetail,
  listServices,
  saveService,
  setServiceActive,
  type ServiceAdminStore,
} from "@/server/services/service";

vi.mock("server-only", () => ({}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const RADIOLOGY_ID = "00000000-0000-4000-8000-000000000301";
const XRAY_ID = "00000000-0000-4000-8000-000000000801";

const XRAY: HospitalService = {
  id: XRAY_ID,
  name: "X-ray",
  description: null,
  departmentId: RADIOLOGY_ID,
  departmentName: "Radiology",
  requiresAppointment: false,
  bookingMode: "walk_in",
  isActive: true,
};

function fakeStore() {
  return {
    listServices: vi.fn().mockResolvedValue([XRAY]),
    getService: vi.fn().mockResolvedValue(XRAY),
    save: vi.fn().mockResolvedValue({ ok: true, serviceId: XRAY_ID }),
    setActive: vi.fn().mockResolvedValue({ ok: true }),
  } satisfies ServiceAdminStore;
}

let store: ReturnType<typeof fakeStore>;

beforeEach(() => {
  store = fakeStore();
});

describe("listServices", () => {
  it("passes the department and status filters to the store", async () => {
    await expect(
      listServices({ departmentId: RADIOLOGY_ID, status: "active" }, store),
    ).resolves.toEqual([XRAY]);
    expect(store.listServices).toHaveBeenCalledWith({ departmentId: RADIOLOGY_ID, status: "active" });
  });
});

describe("getServiceDetail", () => {
  it("returns the service, or null when it is missing", async () => {
    await expect(getServiceDetail(XRAY_ID, store)).resolves.toEqual(XRAY);
    store.getService.mockResolvedValue(null);
    await expect(getServiceDetail(XRAY_ID, store)).resolves.toBeNull();
  });
});

describe("saveService", () => {
  const INPUT = {
    name: "X-ray",
    description: null,
    departmentId: RADIOLOGY_ID,
    requiresAppointment: false,
    bookingMode: "walk_in" as const,
  };

  it("saves as the acting admin and returns the service id", async () => {
    await expect(
      saveService({ actorId: ADMIN_ID, serviceId: null, input: INPUT }, store),
    ).resolves.toEqual({ ok: true, serviceId: XRAY_ID, message: "Service saved." });
    expect(store.save).toHaveBeenCalledWith({ actorId: ADMIN_ID, serviceId: null, ...INPUT });
  });

  it.each([
    ["duplicate", "A service with that name already exists."],
    ["inactive_department", "Choose an active department."],
    ["not_admin", "Only an active administrator can manage services."],
    ["not_found", "That service no longer exists."],
    [undefined, "Something went wrong. Try again."],
    ["something_else", "Something went wrong. Try again."],
  ])("maps refusal %s to its message", async (code, message) => {
    store.save.mockResolvedValue({ ok: false, code });

    await expect(
      saveService({ actorId: ADMIN_ID, serviceId: XRAY_ID, input: INPUT }, store),
    ).resolves.toEqual({ ok: false, message });
  });
});

describe("setServiceActive", () => {
  it.each([
    [false, "Service deactivated."],
    [true, "Service activated."],
  ])("sets isActive=%s as the acting admin", async (isActive, message) => {
    await expect(
      setServiceActive({ actorId: ADMIN_ID, serviceId: XRAY_ID, isActive }, store),
    ).resolves.toEqual({ ok: true, message });
    expect(store.setActive).toHaveBeenCalledWith({ actorId: ADMIN_ID, serviceId: XRAY_ID, isActive });
  });

  it("maps a database refusal to its message", async () => {
    store.setActive.mockResolvedValue({ ok: false, code: "unchanged" });

    await expect(
      setServiceActive({ actorId: ADMIN_ID, serviceId: XRAY_ID, isActive: false }, store),
    ).resolves.toEqual({ ok: false, message: "Nothing to change." });
  });
});
