// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

import { getAdminSession } from "@/server/auth/dal";
import { saveServiceScheduleAction } from "@/server/services/actions";
import { saveServiceSchedule } from "@/server/services/service";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getAdminSession: vi.fn() }));
vi.mock("@/server/services/repository", () => ({ supabaseServiceAdminRepository: {} }));
vi.mock("@/server/services/service", () => ({
  saveService: vi.fn(),
  setServiceActive: vi.fn(),
  saveServiceSchedule: vi.fn(),
}));

/** PAY-07: the admin's service hours, saved through the audited 0038 function. */

const IDLE = { status: "idle" } as const;
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const SERVICE_ID = "00000000-0000-4000-8000-000000000801";
const SCHEDULE_ID = "00000000-0000-4000-8000-000000000901";

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const VALID = {
  serviceId: SERVICE_ID,
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "12:00",
  slotMinutes: "30",
  capacityPerSlot: "1",
  effectiveFrom: "2026-11-17",
  effectiveUntil: "",
  isActive: "true",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminSession).mockResolvedValue({
    user: { id: "auth-admin", email: "admin@example.test" },
    admin: { id: ADMIN_ID, fullName: "Synthetic Admin" },
  });
  vi.mocked(saveServiceSchedule).mockResolvedValue({ ok: true, message: "Hours saved." });
});

describe("saveServiceScheduleAction", () => {
  it("denies non-admin accounts", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    await expect(saveServiceScheduleAction(IDLE, formData(VALID))).resolves.toEqual({
      status: "error",
      message: "You are not authorized to manage services.",
    });
    expect(saveServiceSchedule).not.toHaveBeenCalled();
  });

  it("saves a new period with the actor from the session", async () => {
    await expect(
      saveServiceScheduleAction(IDLE, formData({ ...VALID, actorId: "spoofed" })),
    ).resolves.toEqual({ status: "success", message: "Hours saved." });
    expect(saveServiceSchedule).toHaveBeenCalledWith(
      {
        actorId: ADMIN_ID,
        serviceId: SERVICE_ID,
        scheduleId: null,
        input: {
          dayOfWeek: 1,
          startTime: "08:00",
          endTime: "12:00",
          slotDurationMinutes: 30,
          capacityPerSlot: 1,
          effectiveFrom: "2026-11-17",
          effectiveUntil: null,
          isActive: true,
        },
      },
      {},
    );
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("deactivates an existing period", async () => {
    await saveServiceScheduleAction(
      IDLE,
      formData({ ...VALID, scheduleId: SCHEDULE_ID, isActive: "false" }),
    );
    expect(saveServiceSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: SCHEDULE_ID,
        input: expect.objectContaining({ isActive: false }),
      }),
      {},
    );
  });

  it("refuses bad hours and capacity before calling the database", async () => {
    for (const bad of [
      { endTime: "07:00" },
      { slotMinutes: "20" },
      { capacityPerSlot: "0" },
      { serviceId: "nope" },
    ]) {
      const state = await saveServiceScheduleAction(IDLE, formData({ ...VALID, ...bad }));
      expect(state.status).toBe("error");
    }
    expect(saveServiceSchedule).not.toHaveBeenCalled();
  });
});
