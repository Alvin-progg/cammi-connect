// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DoctorSummary, Specialty } from "@/lib/directory/types";
import type { WeeklySchedule } from "@/lib/schedules/types";
import {
  getAvailableSlots,
  type AvailabilitySource,
} from "@/server/availability/service";

vi.mock("server-only", () => ({}));

const SPECIALTY: Specialty = {
  id: "00000000-0000-4000-8000-000000000701",
  name: "Internal Medicine",
  description: null,
  isActive: true,
};

function doctor(id: string, fullName: string, isActive = true): DoctorSummary {
  return {
    id,
    fullName,
    departmentId: null,
    departmentName: null,
    isActive,
    specialties: [{ id: SPECIALTY.id, name: SPECIALTY.name }],
  };
}

const DR_REYES = doctor("00000000-0000-4000-8000-000000000101", "Dr. Paolo Reyes");
const DR_MERCADO = doctor("00000000-0000-4000-8000-000000000102", "Dr. Liza Mercado");

// 2026-11-02 is a Monday in Asia/Manila.
const NOW = new Date("2026-11-01T12:00:00+08:00");

function mondayNineToTen(doctorId: string): WeeklySchedule {
  return {
    id: `schedule-${doctorId}`,
    doctorId,
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:00",
    slotDurationMinutes: 30,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    isActive: true,
  };
}

function createSource(overrides: Partial<AvailabilitySource> = {}): AvailabilitySource {
  return {
    listSpecialties: vi.fn().mockResolvedValue([SPECIALTY]),
    listDoctors: vi.fn().mockResolvedValue([DR_REYES, DR_MERCADO]),
    getDoctor: vi.fn().mockResolvedValue(DR_REYES),
    listSchedulesForDoctor: vi
      .fn()
      .mockImplementation(async (doctorId: string) => [mondayNineToTen(doctorId)]),
    listExceptionsForDoctor: vi.fn().mockResolvedValue([]),
    listActiveIntervals: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAvailableSlots", () => {
  it("returns slots for one doctor without exposing anything but name and times", async () => {
    const source = createSource();

    await expect(
      getAvailableSlots(
        { doctorId: DR_REYES.id, fromDate: "2026-11-02", days: 1, now: NOW },
        source,
      ),
    ).resolves.toEqual([
      {
        doctorId: DR_REYES.id,
        doctorName: "Dr. Paolo Reyes",
        slots: [
          { start: "2026-11-02T01:00:00.000Z", end: "2026-11-02T01:30:00.000Z" },
          { start: "2026-11-02T01:30:00.000Z", end: "2026-11-02T02:00:00.000Z" },
        ],
      },
    ]);
    expect(source.listActiveIntervals).toHaveBeenCalledWith({
      doctorId: DR_REYES.id,
      start: "2026-11-01T16:00:00.000Z",
      end: "2026-11-02T16:00:00.000Z",
    });
  });

  it("resolves a specialty to its active doctors", async () => {
    const source = createSource();

    const result = await getAvailableSlots(
      { specialtyId: SPECIALTY.id, fromDate: "2026-11-02", days: 1, now: NOW },
      source,
    );

    expect(source.listDoctors).toHaveBeenCalledWith({
      specialtyId: SPECIALTY.id,
      activeOnly: true,
    });
    expect(result.map((entry) => entry.doctorName)).toEqual([
      "Dr. Paolo Reyes",
      "Dr. Liza Mercado",
    ]);
  });

  it("excludes booked and blocked slots", async () => {
    const source = createSource({
      listActiveIntervals: vi.fn().mockResolvedValue([
        { start: "2026-11-02T01:00:00.000Z", end: "2026-11-02T01:30:00.000Z" },
      ]),
      listExceptionsForDoctor: vi.fn().mockResolvedValue([
        {
          id: "exception-1",
          startsAt: "2026-11-02T01:30:00.000Z",
          endsAt: "2026-11-02T02:00:00.000Z",
          exceptionType: "blocked_period",
          reason: "Rounds",
        },
      ]),
    });

    const [availability] = await getAvailableSlots(
      { doctorId: DR_REYES.id, fromDate: "2026-11-02", days: 1, now: NOW },
      source,
    );

    expect(availability.slots).toEqual([]);
  });

  it("returns nothing for an inactive or unknown doctor", async () => {
    await expect(
      getAvailableSlots(
        { doctorId: DR_REYES.id, fromDate: "2026-11-02", days: 1, now: NOW },
        createSource({
          getDoctor: vi.fn().mockResolvedValue({ ...DR_REYES, isActive: false }),
        }),
      ),
    ).resolves.toEqual([]);
    await expect(
      getAvailableSlots(
        { doctorId: DR_REYES.id, fromDate: "2026-11-02", days: 1, now: NOW },
        createSource({ getDoctor: vi.fn().mockResolvedValue(null) }),
      ),
    ).resolves.toEqual([]);
  });

  it("returns nothing for a doctor outside the requested specialty", async () => {
    const source = createSource({
      getDoctor: vi.fn().mockResolvedValue({ ...DR_REYES, specialties: [] }),
    });

    await expect(
      getAvailableSlots(
        {
          doctorId: DR_REYES.id,
          specialtyId: SPECIALTY.id,
          fromDate: "2026-11-02",
          days: 1,
          now: NOW,
        },
        source,
      ),
    ).resolves.toEqual([]);
  });

  it("returns nothing for an inactive specialty", async () => {
    const source = createSource({
      listSpecialties: vi.fn().mockResolvedValue([{ ...SPECIALTY, isActive: false }]),
    });

    await expect(
      getAvailableSlots(
        { specialtyId: SPECIALTY.id, fromDate: "2026-11-02", days: 1, now: NOW },
        source,
      ),
    ).resolves.toEqual([]);
    expect(source.listDoctors).not.toHaveBeenCalled();
  });
});
