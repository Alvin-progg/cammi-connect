// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getFrontDeskSession } from "@/server/auth/dal";
import {
  cancelAppointmentAction,
  confirmRequestAction,
  recordAttendanceAction,
  rejectRequestAction,
  rescheduleAppointmentAction,
} from "@/server/front-desk/actions";
import { supabaseFrontDeskRequestsWriter } from "@/server/front-desk/repository";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/dal", () => ({ getFrontDeskSession: vi.fn() }));
vi.mock("@/server/front-desk/repository", () => ({
  supabaseFrontDeskRequestsRepository: {},
  supabaseFrontDeskRequestsWriter: {
    confirm: vi.fn(),
    reject: vi.fn(),
    recordAttendance: vi.fn(),
    reschedule: vi.fn(),
    cancel: vi.fn(),
  },
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
  writer.recordAttendance.mockResolvedValue({ ok: true });
  writer.reschedule.mockResolvedValue({ ok: true });
  writer.cancel.mockResolvedValue({ ok: true });
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

describe("recordAttendanceAction", () => {
  it.each([
    ["checked_in", "Patient checked in."],
    ["completed", "Appointment marked completed."],
    ["no_show", "Appointment marked as no-show."],
  ])("records %s as the signed-in staff member", async (status, message) => {
    await expect(
      recordAttendanceAction(IDLE, formData({ appointmentId: APPOINTMENT_ID, status })),
    ).resolves.toEqual({ status: "success", message });

    expect(writer.recordAttendance).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: "00000000-0000-4000-8000-000000000301",
      status,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/front-desk/schedule");
    expect(revalidatePath).toHaveBeenCalledWith(`/front-desk/requests/${APPOINTMENT_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/doctor");
  });

  it("ignores a staff id sent in the form", async () => {
    await recordAttendanceAction(
      IDLE,
      formData({
        appointmentId: APPOINTMENT_ID,
        status: "checked_in",
        staffId: "00000000-0000-4000-8000-000000000999",
      }),
    );

    expect(writer.recordAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ staffId: "00000000-0000-4000-8000-000000000301" }),
    );
  });

  it("refuses accounts that are not front desk staff without writing", async () => {
    vi.mocked(getFrontDeskSession).mockResolvedValue(null);

    await expect(
      recordAttendanceAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, status: "checked_in" }),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "You are not authorized to manage appointment requests.",
    });
    expect(writer.recordAttendance).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a status that is not an attendance status", async () => {
    await expect(
      recordAttendanceAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, status: "confirmed" }),
      ),
    ).resolves.toEqual({ status: "error", message: "Choose an attendance status." });
    expect(writer.recordAttendance).not.toHaveBeenCalled();
  });

  it("rejects a malformed appointment reference", async () => {
    await expect(
      recordAttendanceAction(IDLE, formData({ appointmentId: "202", status: "no_show" })),
    ).resolves.toEqual({ status: "error", message: "Invalid appointment reference." });
    expect(writer.recordAttendance).not.toHaveBeenCalled();
  });

  it("reports why the database refused the update", async () => {
    writer.recordAttendance.mockResolvedValue({
      ok: false,
      error: { code: "P0001", message: "not_yet" },
    });

    await expect(
      recordAttendanceAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, status: "checked_in" }),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "Attendance can only be recorded on or after the appointment day.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("rescheduleAppointmentAction", () => {
  const NEW_TIME = "2026-11-05T01:30:00.000Z";

  it("moves the appointment as the signed-in staff member and refreshes the views", async () => {
    await expect(
      rescheduleAppointmentAction(
        IDLE,
        formData({
          appointmentId: APPOINTMENT_ID,
          scheduledAt: NEW_TIME,
          reason: "patient_request",
          details: "Asked to move to Thursday.",
          staffId: "00000000-0000-4000-8000-000000000999",
        }),
      ),
    ).resolves.toEqual({ status: "success", message: "Appointment rescheduled." });

    expect(writer.reschedule).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: "00000000-0000-4000-8000-000000000301",
      scheduledAt: NEW_TIME,
      reason: "Patient request: Asked to move to Thursday.",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/front-desk/requests/${APPOINTMENT_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/front-desk/schedule");
    expect(revalidatePath).toHaveBeenCalledWith("/doctor");
  });

  it("refuses accounts that are not front desk staff without writing", async () => {
    vi.mocked(getFrontDeskSession).mockResolvedValue(null);

    await expect(
      rescheduleAppointmentAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, scheduledAt: NEW_TIME, reason: "patient_request" }),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "You are not authorized to manage appointment requests.",
    });
    expect(writer.reschedule).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("requires a new time and a reason", async () => {
    await expect(
      rescheduleAppointmentAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, reason: "patient_request" }),
      ),
    ).resolves.toEqual({ status: "error", message: "Choose a new time." });
    await expect(
      rescheduleAppointmentAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, scheduledAt: NEW_TIME }),
      ),
    ).resolves.toEqual({ status: "error", message: "Choose a reason for rescheduling." });
    expect(writer.reschedule).not.toHaveBeenCalled();
  });

  it("reports a slot that was just taken", async () => {
    writer.reschedule.mockResolvedValue({
      ok: false,
      error: { code: "23P01", message: "conflicting key value violates exclusion constraint" },
    });

    await expect(
      rescheduleAppointmentAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, scheduledAt: NEW_TIME, reason: "patient_request" }),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "That slot was just taken. Choose another time.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("cancelAppointmentAction", () => {
  it("cancels with the chosen reason as the signed-in staff member", async () => {
    await expect(
      cancelAppointmentAction(
        IDLE,
        formData({
          appointmentId: APPOINTMENT_ID,
          reason: "other",
          details: "Clinic closed for a facility inspection.",
        }),
      ),
    ).resolves.toEqual({ status: "success", message: "Appointment cancelled." });

    expect(writer.cancel).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: "00000000-0000-4000-8000-000000000301",
      reason: "Other hospital-approved reason: Clinic closed for a facility inspection.",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/front-desk/schedule");
  });

  it("refuses accounts that are not front desk staff without writing", async () => {
    vi.mocked(getFrontDeskSession).mockResolvedValue(null);

    await expect(
      cancelAppointmentAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, reason: "patient_request" }),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "You are not authorized to manage appointment requests.",
    });
    expect(writer.cancel).not.toHaveBeenCalled();
  });

  it("requires details for an other reason", async () => {
    await expect(
      cancelAppointmentAction(IDLE, formData({ appointmentId: APPOINTMENT_ID, reason: "other" })),
    ).resolves.toEqual({
      status: "error",
      message: "Describe the reason for cancelling this appointment.",
    });
    expect(writer.cancel).not.toHaveBeenCalled();
  });

  it("reports that a completed appointment cannot be cancelled", async () => {
    writer.cancel.mockResolvedValue({
      ok: false,
      error: { code: "P0001", message: "not_cancellable" },
    });

    await expect(
      cancelAppointmentAction(
        IDLE,
        formData({ appointmentId: APPOINTMENT_ID, reason: "patient_request" }),
      ),
    ).resolves.toEqual({
      status: "error",
      message:
        "Only pending or confirmed appointments can be cancelled. Refresh to see its current status.",
    });
  });
});
