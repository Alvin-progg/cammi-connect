// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getFrontDeskSession } from "@/server/auth/dal";
import {
  confirmRequestAction,
  rejectRequestAction,
} from "@/server/front-desk/actions";
import { supabaseFrontDeskRequestsWriter } from "@/server/front-desk/repository";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getFrontDeskSession: vi.fn() }));
vi.mock("@/server/front-desk/repository", () => ({
  supabaseFrontDeskRequestsRepository: {},
  supabaseFrontDeskRequestsWriter: { confirm: vi.fn(), reject: vi.fn() },
}));

const IDLE = { status: "idle" } as const;
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";
const writer = vi.mocked(supabaseFrontDeskRequestsWriter);

const STAFF_SESSION = {
  user: { id: "auth-front-desk", email: "frontdesk@example.test" },
  staff: { id: "00000000-0000-4000-8000-000000000301", fullName: "Synthetic Front Desk" },
};

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.append(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  writer.confirm.mockResolvedValue({ ok: true });
  writer.reject.mockResolvedValue({ ok: true });
  vi.mocked(getFrontDeskSession).mockResolvedValue(STAFF_SESSION);
});

describe("confirmRequestAction", () => {
  it("confirms as the signed-in staff member and refreshes the views", async () => {
    await expect(
      confirmRequestAction(IDLE, formData({ appointmentId: APPOINTMENT_ID })),
    ).resolves.toEqual({ status: "success", message: "Appointment confirmed." });

    expect(writer.confirm).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: "00000000-0000-4000-8000-000000000301",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/front-desk/requests");
    expect(revalidatePath).toHaveBeenCalledWith(`/front-desk/requests/${APPOINTMENT_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/doctor");
  });

  it("refuses accounts that are not front desk staff without writing", async () => {
    vi.mocked(getFrontDeskSession).mockResolvedValue(null);

    await expect(
      confirmRequestAction(IDLE, formData({ appointmentId: APPOINTMENT_ID })),
    ).resolves.toEqual({
      status: "error",
      message: "You are not authorized to manage appointment requests.",
    });
    expect(writer.confirm).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a malformed appointment reference", async () => {
    await expect(
      confirmRequestAction(IDLE, formData({ appointmentId: "202" })),
    ).resolves.toEqual({ status: "error", message: "Invalid appointment reference." });
    expect(writer.confirm).not.toHaveBeenCalled();
  });

  it("reports why the database refused the confirmation", async () => {
    writer.confirm.mockResolvedValue({
      ok: false,
      error: { code: "P0001", message: "not_pending" },
    });

    await expect(
      confirmRequestAction(IDLE, formData({ appointmentId: APPOINTMENT_ID })),
    ).resolves.toEqual({
      status: "error",
      message: "This request is no longer pending. Refresh to see its current status.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("rejectRequestAction", () => {
  it("rejects with the chosen reason and details", async () => {
    await expect(
      rejectRequestAction(
        IDLE,
        formData({
          appointmentId: APPOINTMENT_ID,
          reason: "other",
          details: "Patient asked for a different hospital branch.",
        }),
      ),
    ).resolves.toEqual({ status: "success", message: "Request rejected." });

    expect(writer.reject).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: "00000000-0000-4000-8000-000000000301",
      reason: "Other hospital-approved reason: Patient asked for a different hospital branch.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/front-desk/requests");
  });

  it("requires a reason", async () => {
    await expect(
      rejectRequestAction(IDLE, formData({ appointmentId: APPOINTMENT_ID })),
    ).resolves.toEqual({ status: "error", message: "Choose a reason for rejecting." });
    expect(writer.reject).not.toHaveBeenCalled();
  });

  it("refuses accounts that are not front desk staff without writing", async () => {
    vi.mocked(getFrontDeskSession).mockResolvedValue(null);

    const state = await rejectRequestAction(
      IDLE,
      formData({ appointmentId: APPOINTMENT_ID, reason: "doctor_unavailable" }),
    );

    expect(state.status).toBe("error");
    expect(writer.reject).not.toHaveBeenCalled();
  });
});
