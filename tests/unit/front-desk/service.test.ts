// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { RequestDetails } from "@/lib/front-desk/requests";
import { SCHEDULE_LIMIT, type ScheduleItem } from "@/lib/front-desk/schedule";
import {
  QUEUE_LIMIT,
  checkRequestSlot,
  confirmRequest,
  getRequestDetails,
  listDailySchedule,
  listRequestQueue,
  cancelAppointment,
  listRescheduleSlots,
  recordAttendance,
  rejectRequest,
  rescheduleAppointment,
  type FrontDeskRequestsReader,
  type FrontDeskRequestsWriter,
  type FrontDeskScheduleReader,
} from "@/server/front-desk/service";

vi.mock("server-only", () => ({}));

const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000501";
const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000202";

function createReader(
  overrides: Partial<FrontDeskRequestsReader> = {},
): FrontDeskRequestsReader {
  return {
    listRequests: vi.fn().mockResolvedValue([]),
    getRequest: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("listRequestQueue", () => {
  it("maps the pending filter to the stored requested status", async () => {
    const reader = createReader();

    await listRequestQueue(
      { status: "pending", date: null, doctorId: null, specialtyId: null },
      reader,
    );

    expect(reader.listRequests).toHaveBeenCalledWith({
      status: "requested",
      start: null,
      end: null,
      doctorId: null,
      specialtyId: null,
      limit: QUEUE_LIMIT,
    });
  });

  it("applies no status filter for all", async () => {
    const reader = createReader();

    await listRequestQueue(
      { status: "all", date: null, doctorId: null, specialtyId: null },
      reader,
    );

    expect(reader.listRequests).toHaveBeenCalledWith(
      expect.objectContaining({ status: null }),
    );
  });

  it("turns a date into the Manila day range and passes doctor and specialty", async () => {
    const reader = createReader();

    await listRequestQueue(
      {
        status: "cancelled",
        date: "2026-11-04",
        doctorId: DOCTOR_ID,
        specialtyId: SPECIALTY_ID,
      },
      reader,
    );

    expect(reader.listRequests).toHaveBeenCalledWith({
      status: "cancelled",
      start: "2026-11-03T16:00:00.000Z",
      end: "2026-11-04T16:00:00.000Z",
      doctorId: DOCTOR_ID,
      specialtyId: SPECIALTY_ID,
      limit: QUEUE_LIMIT,
    });
  });

  it("reports when the queue reached its limit", async () => {
    const items = Array.from({ length: QUEUE_LIMIT }, () => ({}));
    const reader = createReader({
      listRequests: vi.fn().mockResolvedValue(items),
    });

    const queue = await listRequestQueue(
      { status: "pending", date: null, doctorId: null, specialtyId: null },
      reader,
    );

    expect(queue.items).toHaveLength(QUEUE_LIMIT);
    expect(queue.limitReached).toBe(true);
  });
});

describe("getRequestDetails", () => {
  it("returns null for a malformed id without reading", async () => {
    const reader = createReader();

    await expect(getRequestDetails("../admin", reader)).resolves.toBeNull();
    expect(reader.getRequest).not.toHaveBeenCalled();
  });

  it("returns null when no Cami request has that id", async () => {
    const reader = createReader();

    await expect(getRequestDetails(APPOINTMENT_ID, reader)).resolves.toBeNull();
    expect(reader.getRequest).toHaveBeenCalledWith(APPOINTMENT_ID);
  });

  it("returns the request details from the reader", async () => {
    const details: RequestDetails = {
      id: APPOINTMENT_ID,
      doctorId: DOCTOR_ID,
      patientName: "Synthetic Patient B",
      patientEmail: null,
      patientPhone: null,
      doctorName: "Dr. Synthetic Reyes",
      specialtyNames: [],
      scheduledAt: "2026-11-04T02:30:00.000Z",
      durationMinutes: 30,
      createdAt: "2026-11-03T01:15:00.000Z",
      status: "requested",
      bookingSource: "ai_chatbot",
      reason: null,
      rejectionReason: null,
      cancellationReason: null,
      history: [],
    };
    const reader = createReader({
      getRequest: vi.fn().mockResolvedValue(details),
    });

    await expect(getRequestDetails(APPOINTMENT_ID, reader)).resolves.toBe(details);
  });
});

const STAFF_ID = "00000000-0000-4000-8000-000000000301";

function createWriter(
  overrides: Partial<FrontDeskRequestsWriter> = {},
): FrontDeskRequestsWriter {
  return {
    confirm: vi.fn().mockResolvedValue({ ok: true }),
    reject: vi.fn().mockResolvedValue({ ok: true }),
    recordAttendance: vi.fn().mockResolvedValue({ ok: true }),
    reschedule: vi.fn().mockResolvedValue({ ok: true }),
    cancel: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function failingWith(message: string, code = "P0001") {
  return vi.fn().mockResolvedValue({ ok: false, error: { code, message } });
}

describe("confirmRequest", () => {
  it("confirms through the writer as the signed-in staff member", async () => {
    const writer = createWriter();

    await expect(
      confirmRequest({ appointmentId: APPOINTMENT_ID, staffId: STAFF_ID }, writer),
    ).resolves.toEqual({ ok: true });
    expect(writer.confirm).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: STAFF_ID,
    });
  });

  it.each([
    ["not_pending", "This request is no longer pending. Refresh to see its current status."],
    ["not_found", "This appointment request no longer exists."],
    ["past", "The requested time has already passed. Reject the request instead."],
    ["outside_hours", "The requested time is no longer within the doctor's consultation hours."],
    ["blocked", "The doctor is unavailable at the requested time."],
    ["inactive_doctor", "This doctor is no longer accepting appointments."],
  ])("explains a %s refusal", async (code, message) => {
    const writer = createWriter({ confirm: failingWith(code) });

    await expect(
      confirmRequest({ appointmentId: APPOINTMENT_ID, staffId: STAFF_ID }, writer),
    ).resolves.toEqual({ ok: false, message });
  });

  it("hides unexpected database errors", async () => {
    const writer = createWriter({
      confirm: failingWith('relation "appointments" does not exist', "42P01"),
    });

    await expect(
      confirmRequest({ appointmentId: APPOINTMENT_ID, staffId: STAFF_ID }, writer),
    ).resolves.toEqual({
      ok: false,
      message: "The request could not be updated. Try again in a moment.",
    });
  });
});

describe("rejectRequest", () => {
  it("rejects through the writer with the reason and staff member", async () => {
    const writer = createWriter();

    await expect(
      rejectRequest(
        {
          appointmentId: APPOINTMENT_ID,
          staffId: STAFF_ID,
          rejectionReason: "Doctor unavailable",
        },
        writer,
      ),
    ).resolves.toEqual({ ok: true });
    expect(writer.reject).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: STAFF_ID,
      reason: "Doctor unavailable",
    });
  });

  it("refuses a blank reason without writing", async () => {
    const writer = createWriter();

    await expect(
      rejectRequest(
        { appointmentId: APPOINTMENT_ID, staffId: STAFF_ID, rejectionReason: "  " },
        writer,
      ),
    ).resolves.toEqual({ ok: false, message: "A rejection reason is required." });
    expect(writer.reject).not.toHaveBeenCalled();
  });

  it("explains a request that is no longer pending", async () => {
    const writer = createWriter({ reject: failingWith("not_pending") });

    await expect(
      rejectRequest(
        {
          appointmentId: APPOINTMENT_ID,
          staffId: STAFF_ID,
          rejectionReason: "Doctor unavailable",
        },
        writer,
      ),
    ).resolves.toEqual({
      ok: false,
      message: "This request is no longer pending. Refresh to see its current status.",
    });
  });
});

describe("checkRequestSlot", () => {
  // 2026-11-04 is a Wednesday; 10:30 PHT is 02:30Z.
  const REQUEST = {
    doctorId: DOCTOR_ID,
    scheduledAt: "2026-11-04T02:30:00.000Z",
    durationMinutes: 30,
  };
  const NOW = new Date("2026-11-03T04:00:00.000Z");
  const WEDNESDAY_MORNING = {
    id: "00000000-0000-4000-8000-000000000913",
    doctorId: DOCTOR_ID,
    dayOfWeek: 3,
    startTime: "08:00",
    endTime: "12:00",
    slotDurationMinutes: 30,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    isActive: true,
  };

  function availability(
    schedules = [WEDNESDAY_MORNING],
    exceptions: { id: string; startsAt: string; endsAt: string; exceptionType: "leave"; reason: string }[] = [],
  ) {
    return {
      listSchedulesForDoctor: vi.fn().mockResolvedValue(schedules),
      listExceptionsForDoctor: vi.fn().mockResolvedValue(exceptions),
    };
  }

  it("reports a slot that is still inside the doctor's hours", async () => {
    const reader = availability();

    await expect(checkRequestSlot(REQUEST, reader, NOW)).resolves.toBe("available");
    expect(reader.listSchedulesForDoctor).toHaveBeenCalledWith(DOCTOR_ID);
    expect(reader.listExceptionsForDoctor).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      start: "2026-11-03T16:00:00.000Z",
      end: "2026-11-04T16:00:00.000Z",
    });
  });

  it("reports a time that has passed", async () => {
    await expect(
      checkRequestSlot(REQUEST, availability(), new Date("2026-11-05T00:00:00.000Z")),
    ).resolves.toBe("past");
  });

  it("reports a time outside the doctor's current hours", async () => {
    await expect(checkRequestSlot(REQUEST, availability([]), NOW)).resolves.toBe(
      "outside_hours",
    );
  });

  it("reports a time blocked by a schedule exception", async () => {
    const reader = availability([WEDNESDAY_MORNING], [
      {
        id: "00000000-0000-4000-8000-000000000401",
        startsAt: "2026-11-04T00:00:00.000Z",
        endsAt: "2026-11-04T04:00:00.000Z",
        exceptionType: "leave",
        reason: "Annual leave",
      },
    ]);

    await expect(checkRequestSlot(REQUEST, reader, NOW)).resolves.toBe("blocked");
  });
});

function scheduleItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: APPOINTMENT_ID,
    patientName: "Synthetic Patient B",
    doctorName: "Dr. Synthetic Reyes",
    specialtyNames: ["Cardiology"],
    scheduledAt: "2026-11-04T01:00:00.000Z",
    durationMinutes: 30,
    status: "confirmed",
    bookingSource: "ai_chatbot",
    ...overrides,
  };
}

function createScheduleReader(items: ScheduleItem[] = []): FrontDeskScheduleReader {
  return { listDay: vi.fn().mockResolvedValue(items) };
}

describe("listDailySchedule", () => {
  it("reads the Manila day with the doctor and status filters", async () => {
    const reader = createScheduleReader();

    await listDailySchedule(
      { date: "2026-11-04", doctorId: DOCTOR_ID, status: "checked_in", search: null },
      reader,
    );

    expect(reader.listDay).toHaveBeenCalledWith({
      start: "2026-11-03T16:00:00.000Z",
      end: "2026-11-04T16:00:00.000Z",
      doctorId: DOCTOR_ID,
      status: "checked_in",
      limit: SCHEDULE_LIMIT,
    });
  });

  it("applies no status filter for all", async () => {
    const reader = createScheduleReader();

    await listDailySchedule(
      { date: "2026-11-04", doctorId: null, status: "all", search: null },
      reader,
    );

    expect(reader.listDay).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: null, status: null }),
    );
  });

  it("keeps only patients whose name contains the search, ignoring case", async () => {
    const ana = scheduleItem({ id: "a", patientName: "Synthetic Ana Cruz" });
    const ben = scheduleItem({ id: "b", patientName: "Synthetic Ben Reyes" });
    const reader = createScheduleReader([ana, ben]);

    await expect(
      listDailySchedule(
        { date: "2026-11-04", doctorId: null, status: "all", search: "ana" },
        reader,
      ),
    ).resolves.toEqual({ items: [ana], limitReached: false });
  });

  it("flags when the day reached the row limit", async () => {
    const reader = createScheduleReader(
      Array.from({ length: SCHEDULE_LIMIT }, (_, index) => scheduleItem({ id: String(index) })),
    );

    const schedule = await listDailySchedule(
      { date: "2026-11-04", doctorId: null, status: "all", search: null },
      reader,
    );

    expect(schedule.limitReached).toBe(true);
  });
});

describe("recordAttendance", () => {
  it("records the status through the writer as the signed-in staff member", async () => {
    const writer = createWriter();

    await expect(
      recordAttendance(
        { appointmentId: APPOINTMENT_ID, staffId: STAFF_ID, status: "checked_in" },
        writer,
      ),
    ).resolves.toEqual({ ok: true });
    expect(writer.recordAttendance).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: STAFF_ID,
      status: "checked_in",
    });
  });

  it.each([
    [
      "invalid_transition",
      "This appointment's status changed and the update no longer applies. Refresh to see its current status.",
    ],
    ["not_yet", "Attendance can only be recorded on or after the appointment day."],
    ["invalid_status", "Choose check-in, completed, or no-show."],
    ["not_found", "This appointment no longer exists."],
  ])("explains a %s refusal", async (code, message) => {
    const writer = createWriter({ recordAttendance: failingWith(code) });

    await expect(
      recordAttendance(
        { appointmentId: APPOINTMENT_ID, staffId: STAFF_ID, status: "no_show" },
        writer,
      ),
    ).resolves.toEqual({ ok: false, message });
  });

  it("hides unexpected database errors", async () => {
    const writer = createWriter({
      recordAttendance: failingWith("function does not exist", "42883"),
    });

    await expect(
      recordAttendance(
        { appointmentId: APPOINTMENT_ID, staffId: STAFF_ID, status: "completed" },
        writer,
      ),
    ).resolves.toEqual({
      ok: false,
      message: "The appointment could not be updated. Try again in a moment.",
    });
  });
});

describe("rescheduleAppointment", () => {
  const NEW_TIME = "2026-11-05T01:30:00.000Z";

  function reschedule(writer: FrontDeskRequestsWriter, rescheduleReason = "Patient request") {
    return rescheduleAppointment(
      {
        appointmentId: APPOINTMENT_ID,
        staffId: STAFF_ID,
        scheduledAt: NEW_TIME,
        rescheduleReason,
      },
      writer,
    );
  }

  it("moves the appointment through the writer as the signed-in staff member", async () => {
    const writer = createWriter();

    await expect(reschedule(writer, "  Patient request  ")).resolves.toEqual({ ok: true });
    expect(writer.reschedule).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: STAFF_ID,
      scheduledAt: NEW_TIME,
      reason: "Patient request",
    });
  });

  it("refuses a blank reason without writing", async () => {
    const writer = createWriter();

    await expect(reschedule(writer, " ")).resolves.toEqual({
      ok: false,
      message: "A reason is required to reschedule.",
    });
    expect(writer.reschedule).not.toHaveBeenCalled();
  });

  it.each([
    ["reason_required", "A reason is required to reschedule."],
    ["not_found", "This appointment no longer exists."],
    [
      "not_reschedulable",
      "Only pending or confirmed appointments can be rescheduled. Refresh to see its current status.",
    ],
    ["unchanged", "Choose a time different from the current one."],
    ["inactive_doctor", "This doctor is no longer accepting appointments."],
    ["past", "Choose a future time."],
    ["outside_hours", "That time is not one of the doctor's consultation slots."],
    ["blocked", "The doctor is unavailable at that time."],
  ])("explains a %s refusal", async (code, message) => {
    await expect(reschedule(createWriter({ reschedule: failingWith(code) }))).resolves.toEqual({
      ok: false,
      message,
    });
  });

  it("explains a slot that another appointment just took", async () => {
    const writer = createWriter({
      reschedule: failingWith(
        'conflicting key value violates exclusion constraint "appointments_no_active_overlap"',
        "23P01",
      ),
    });

    await expect(reschedule(writer)).resolves.toEqual({
      ok: false,
      message: "That slot was just taken. Choose another time.",
    });
  });

  it("hides unexpected database errors", async () => {
    const writer = createWriter({ reschedule: failingWith("function does not exist", "42883") });

    await expect(reschedule(writer)).resolves.toEqual({
      ok: false,
      message: "The appointment could not be updated. Try again in a moment.",
    });
  });
});

describe("cancelAppointment", () => {
  function cancel(writer: FrontDeskRequestsWriter, cancellationReason = "Patient request") {
    return cancelAppointment(
      { appointmentId: APPOINTMENT_ID, staffId: STAFF_ID, cancellationReason },
      writer,
    );
  }

  it("cancels through the writer with the reason and staff member", async () => {
    const writer = createWriter();

    await expect(cancel(writer)).resolves.toEqual({ ok: true });
    expect(writer.cancel).toHaveBeenCalledWith({
      appointmentId: APPOINTMENT_ID,
      staffId: STAFF_ID,
      reason: "Patient request",
    });
  });

  it("refuses a blank reason without writing", async () => {
    const writer = createWriter();

    await expect(cancel(writer, "")).resolves.toEqual({
      ok: false,
      message: "A reason is required to cancel.",
    });
    expect(writer.cancel).not.toHaveBeenCalled();
  });

  it.each([
    ["reason_required", "A reason is required to cancel."],
    ["not_found", "This appointment no longer exists."],
    [
      "not_cancellable",
      "Only pending or confirmed appointments can be cancelled. Refresh to see its current status.",
    ],
  ])("explains a %s refusal", async (code, message) => {
    await expect(cancel(createWriter({ cancel: failingWith(code) }))).resolves.toEqual({
      ok: false,
      message,
    });
  });

  it("hides unexpected database errors", async () => {
    const writer = createWriter({ cancel: failingWith("permission denied", "42501") });

    await expect(cancel(writer)).resolves.toEqual({
      ok: false,
      message: "The appointment could not be updated. Try again in a moment.",
    });
  });
});

describe("listRescheduleSlots", () => {
  // 2026-11-04 is a Wednesday in Manila; 08:00–10:00 PHT is 00:00Z–02:00Z.
  const NOW = new Date("2026-11-03T04:00:00.000Z");
  const CURRENT = "2026-11-04T00:30:00.000Z";
  const WEDNESDAY_EARLY = {
    id: "00000000-0000-4000-8000-000000000914",
    doctorId: DOCTOR_ID,
    dayOfWeek: 3,
    startTime: "08:00",
    endTime: "10:00",
    slotDurationMinutes: 30,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    isActive: true,
  };

  function source(intervals: { start: string; end: string }[] = []) {
    return {
      listSchedulesForDoctor: vi.fn().mockResolvedValue([WEDNESDAY_EARLY]),
      listExceptionsForDoctor: vi.fn().mockResolvedValue([]),
      listActiveIntervals: vi.fn().mockResolvedValue(intervals),
    };
  }

  it("offers the doctor's free slots on the date except the current time", async () => {
    const reader = source([
      { start: "2026-11-04T01:00:00.000Z", end: "2026-11-04T01:30:00.000Z" },
    ]);

    await expect(
      listRescheduleSlots(
        {
          appointmentId: APPOINTMENT_ID,
          doctorId: DOCTOR_ID,
          currentScheduledAt: CURRENT,
          date: "2026-11-04",
        },
        reader,
        NOW,
      ),
    ).resolves.toEqual([
      { start: "2026-11-04T00:00:00.000Z", end: "2026-11-04T00:30:00.000Z" },
      { start: "2026-11-04T01:30:00.000Z", end: "2026-11-04T02:00:00.000Z" },
    ]);
    expect(reader.listSchedulesForDoctor).toHaveBeenCalledWith(DOCTOR_ID);
    const day = { start: "2026-11-03T16:00:00.000Z", end: "2026-11-04T16:00:00.000Z" };
    expect(reader.listExceptionsForDoctor).toHaveBeenCalledWith({ doctorId: DOCTOR_ID, ...day });
    // The appointment's own interval must not block the slots around it.
    expect(reader.listActiveIntervals).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      ...day,
      excludeId: APPOINTMENT_ID,
    });
  });

  it("offers nothing on a day the doctor does not work", async () => {
    await expect(
      listRescheduleSlots(
        {
          appointmentId: APPOINTMENT_ID,
          doctorId: DOCTOR_ID,
          currentScheduledAt: CURRENT,
          date: "2026-11-05",
        },
        source(),
        NOW,
      ),
    ).resolves.toEqual([]);
  });
});
