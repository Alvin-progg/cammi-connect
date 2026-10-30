// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminSession, getDoctorSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";
import {
  addScheduleExceptionAction,
  adminAddScheduleExceptionAction,
  adminRemoveScheduleExceptionAction,
  adminSaveSchedulePeriodAction,
  removeScheduleExceptionAction,
  saveSchedulePeriodAction,
} from "@/server/schedules/actions";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({
  getDoctorSession: vi.fn(),
  getAdminSession: vi.fn(),
}));
vi.mock("@/server/directory/repository", () => ({
  supabaseDirectoryRepository: { getDoctor: vi.fn() },
}));
vi.mock("@/server/schedules/repository", () => ({
  supabaseDoctorSchedulesRepository: {
    listSchedulesForDoctor: vi.fn(),
    listExceptionsForDoctor: vi.fn(),
    createSchedulePeriod: vi.fn(),
    updateSchedulePeriod: vi.fn(),
    addException: vi.fn(),
    removeException: vi.fn(),
    listActiveIntervals: vi.fn(),
  },
}));

const OWN_DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_DOCTOR_ID = "00000000-0000-4000-8000-000000000102";
const EXCEPTION_ID = "00000000-0000-4000-8000-000000000951";
const IDLE = { status: "idle" } as const;
const store = vi.mocked(supabaseDoctorSchedulesRepository);

const DOCTOR_SESSION = {
  user: { id: "auth-doctor", email: "doctor@example.test" },
  doctor: { id: OWN_DOCTOR_ID, fullName: "Dr. Maya Santos" },
};
const ADMIN_SESSION = {
  user: { id: "auth-admin", email: "admin@example.test" },
  admin: { id: "admin-profile-1", fullName: "Synthetic Admin" },
};

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

const PERIOD_FIELDS = {
  dayOfWeek: "1",
  isActive: "on",
  startTime: "13:00",
  endTime: "17:00",
  slotDurationMinutes: "30",
  effectiveFrom: "2026-11-02",
  effectiveUntil: "",
};

const EXCEPTION_FIELDS = {
  startDate: "2026-11-02",
  endDate: "",
  startTime: "",
  endTime: "",
  exceptionType: "leave",
  reason: "Annual leave",
};

beforeEach(() => {
  vi.clearAllMocks();
  store.listSchedulesForDoctor.mockResolvedValue([]);
  store.createSchedulePeriod.mockResolvedValue("saved");
  store.addException.mockResolvedValue(undefined);
  store.removeException.mockResolvedValue(true);
  store.listActiveIntervals.mockResolvedValue([]);
});

describe("doctor schedule actions", () => {
  it("saves a period for the session doctor, ignoring any doctorId in the form", async () => {
    vi.mocked(getDoctorSession).mockResolvedValue(DOCTOR_SESSION);

    const result = await saveSchedulePeriodAction(
      IDLE,
      formData({ ...PERIOD_FIELDS, doctorId: OTHER_DOCTOR_ID }),
    );

    expect(result).toEqual({ status: "success", message: "Consultation hours saved." });
    expect(store.createSchedulePeriod).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: OWN_DOCTOR_ID }),
    );
  });

  it("removes exceptions only within the session doctor's schedule", async () => {
    vi.mocked(getDoctorSession).mockResolvedValue(DOCTOR_SESSION);

    await removeScheduleExceptionAction(
      IDLE,
      formData({ exceptionId: EXCEPTION_ID, doctorId: OTHER_DOCTOR_ID }),
    );

    expect(store.removeException).toHaveBeenCalledWith({
      doctorId: OWN_DOCTOR_ID,
      exceptionId: EXCEPTION_ID,
    });
  });

  it("denies accounts without the doctor role", async () => {
    vi.mocked(getDoctorSession).mockResolvedValue(null);

    await expect(
      addScheduleExceptionAction(IDLE, formData(EXCEPTION_FIELDS)),
    ).resolves.toEqual({
      status: "error",
      message: "You are not authorized to manage this schedule.",
    });
    expect(store.addException).not.toHaveBeenCalled();
  });

  it("returns validation errors without writing", async () => {
    vi.mocked(getDoctorSession).mockResolvedValue(DOCTOR_SESSION);

    await expect(
      saveSchedulePeriodAction(IDLE, formData({ ...PERIOD_FIELDS, endTime: "12:00" })),
    ).resolves.toEqual({
      status: "error",
      message: "End time must be after the start time.",
    });
    expect(store.createSchedulePeriod).not.toHaveBeenCalled();
  });
});

describe("admin schedule actions", () => {
  it("manages the doctor named in the form after the admin check", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(supabaseDirectoryRepository.getDoctor).mockResolvedValue({
      id: OTHER_DOCTOR_ID,
      fullName: "Dr. Liza Mercado",
      departmentId: null,
      departmentName: null,
      isActive: true,
      specialties: [],
    });

    await adminSaveSchedulePeriodAction(
      IDLE,
      formData({ ...PERIOD_FIELDS, doctorId: OTHER_DOCTOR_ID }),
    );

    expect(store.createSchedulePeriod).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: OTHER_DOCTOR_ID }),
    );
  });

  it("denies doctors and patients, who have no admin session", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);

    await expect(
      adminSaveSchedulePeriodAction(
        IDLE,
        formData({ ...PERIOD_FIELDS, doctorId: OTHER_DOCTOR_ID }),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "You are not authorized to manage this schedule.",
    });
    await expect(
      adminAddScheduleExceptionAction(
        IDLE,
        formData({ ...EXCEPTION_FIELDS, doctorId: OTHER_DOCTOR_ID }),
      ),
    ).resolves.toMatchObject({ status: "error" });
    await expect(
      adminRemoveScheduleExceptionAction(
        IDLE,
        formData({ exceptionId: EXCEPTION_ID, doctorId: OTHER_DOCTOR_ID }),
      ),
    ).resolves.toMatchObject({ status: "error" });
    expect(store.createSchedulePeriod).not.toHaveBeenCalled();
    expect(store.addException).not.toHaveBeenCalled();
    expect(store.removeException).not.toHaveBeenCalled();
  });

  it("rejects an unknown doctor", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(ADMIN_SESSION);
    vi.mocked(supabaseDirectoryRepository.getDoctor).mockResolvedValue(null);

    await expect(
      adminSaveSchedulePeriodAction(
        IDLE,
        formData({ ...PERIOD_FIELDS, doctorId: OTHER_DOCTOR_ID }),
      ),
    ).resolves.toEqual({ status: "error", message: "That doctor no longer exists." });
    expect(store.createSchedulePeriod).not.toHaveBeenCalled();
  });
});
