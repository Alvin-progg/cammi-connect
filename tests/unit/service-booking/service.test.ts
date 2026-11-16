// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { BookableService } from "@/lib/services/booking";
import {
  bookServiceWithCharge,
  getServiceTimes,
  type ServiceBookingInput,
  type ServiceBookingStore,
} from "@/server/service-booking/service";

const CBC: BookableService = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "CBC with platelet count",
  category: "laboratory",
  bookingMode: "walk_in",
  priceCentavos: 25000,
  vatable: false,
  philhealthBenefitCentavos: 0,
  hmoCoverable: true,
  requiresDoctorRequest: true,
  dailyCapacity: 1,
};

const ULTRASOUND: BookableService = {
  ...CBC,
  id: "22222222-2222-4222-8222-222222222222",
  name: "Whole abdomen ultrasound",
  category: "imaging",
  bookingMode: "scheduled",
  priceCentavos: 150000,
  dailyCapacity: null,
};

function store(overrides: Partial<ServiceBookingStore> = {}): ServiceBookingStore {
  return {
    listBookableServices: vi.fn(async () => [CBC, ULTRASOUND]),
    listPeriods: vi.fn(async (ids: string[]) =>
      ids.map((serviceId) => ({
        serviceId,
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "09:00",
        slotMinutes: 30,
        capacityPerSlot: 1,
        effectiveFrom: "2026-01-01",
        effectiveUntil: null,
        isActive: true,
      })),
    ),
    listHolidays: vi.fn(async () => []),
    getLoad: vi.fn(async () => []),
    listRequirements: vi.fn(async () => []),
    bookService: vi.fn(),
    ...overrides,
  };
}

const NOW = new Date("2026-11-15T12:00:00+08:00");

describe("getServiceTimes", () => {
  it("offers walk-in dates without a full day", async () => {
    const fake = store({
      getLoad: vi.fn(async () => [
        { serviceId: CBC.id, start: new Date("2026-11-16T08:00:00+08:00"), bookings: 1 },
      ]),
    });
    const times = await getServiceTimes(
      { services: [CBC], fromDate: "2026-11-16", days: 8, earliestStart: NOW },
      fake,
    );
    expect(times).toEqual({
      mode: "walk_in",
      dates: [
        {
          date: "2026-11-23",
          start: new Date("2026-11-23T08:00:00+08:00"),
          end: new Date("2026-11-23T09:00:00+08:00"),
        },
      ],
    });
    expect(fake.getLoad).toHaveBeenCalledWith({
      serviceIds: [CBC.id],
      from: new Date("2026-11-16T00:00:00+08:00"),
      to: new Date("2026-11-24T00:00:00+08:00"),
    });
  });

  it("offers scheduled slots below capacity", async () => {
    const fake = store({
      getLoad: vi.fn(async () => [
        { serviceId: ULTRASOUND.id, start: new Date("2026-11-16T08:00:00+08:00"), bookings: 1 },
      ]),
    });
    const times = await getServiceTimes(
      { services: [ULTRASOUND], fromDate: "2026-11-16", days: 1, earliestStart: NOW },
      fake,
    );
    expect(times).toEqual({
      mode: "scheduled",
      slots: [
        {
          start: new Date("2026-11-16T08:30:00+08:00"),
          end: new Date("2026-11-16T09:00:00+08:00"),
        },
      ],
    });
  });
});

describe("bookServiceWithCharge", () => {
  const input: ServiceBookingInput = {
    patientId: "33333333-3333-4333-8333-333333333333",
    serviceIds: [CBC.id],
    visitDate: "2026-11-23",
    start: null,
    reason: null,
    privilege: "none",
    payment: { payer: "self", method: "qr_ph" },
    expectedAmountDueCentavos: 25000,
  };

  it("returns the payment the database created", async () => {
    const payment = {
      id: "p1",
      method: "qr_ph" as const,
      status: "awaiting_payment" as const,
      amountDueCentavos: 25000,
      referenceCode: "CC-ABCDE",
      deadline: "2026-11-15T14:00:00.000Z",
    };
    const fake = store({ bookService: vi.fn(async () => ({ ok: true as const, appointmentId: "a1", payment })) });
    await expect(bookServiceWithCharge(input, fake)).resolves.toEqual({
      ok: true,
      appointmentId: "a1",
      payment,
    });
  });

  it.each([
    ["service_full", "fully booked"],
    ["slot_full", "just booked"],
    ["price_changed", "price"],
    ["too_many_upcoming", "maximum number"],
    ["outside_hours", "open"],
  ])("maps %s to a patient message", async (code, text) => {
    const fake = store({
      bookService: vi.fn(async () => ({ ok: false as const, error: { code: "P0001", message: code } })),
    });
    const outcome = await bookServiceWithCharge(input, fake);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? "" : outcome.message).toContain(text);
  });

  it("throws without database details on anything unknown", async () => {
    const fake = store({
      bookService: vi.fn(async () => ({ ok: false as const, error: { code: "XX000", message: "secret" } })),
    });
    await expect(bookServiceWithCharge(input, fake)).rejects.toThrow("Unable to book the service.");
  });
});
