// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { RequestDetails } from "@/lib/front-desk/requests";
import {
  QUEUE_LIMIT,
  getRequestDetails,
  listRequestQueue,
  type FrontDeskRequestsReader,
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
