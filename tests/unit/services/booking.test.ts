import { describe, expect, it } from "vitest";

import { computeCharge } from "@/lib/billing/compute";
import {
  hmoOffered,
  serviceKindOf,
  serviceLine,
  serviceSlots,
  validateServiceSelection,
  walkInDates,
  type BookableService,
  type ServicePeriod,
} from "@/lib/services/booking";

function service(overrides: Partial<BookableService> = {}): BookableService {
  return {
    id: "cbc",
    name: "CBC with platelet count",
    category: "laboratory",
    bookingMode: "walk_in",
    priceCentavos: 25000,
    vatable: false,
    philhealthBenefitCentavos: 0,
    hmoCoverable: true,
    requiresDoctorRequest: true,
    dailyCapacity: null,
    ...overrides,
  };
}

function period(overrides: Partial<ServicePeriod> = {}): ServicePeriod {
  return {
    serviceId: "cbc",
    dayOfWeek: 1,
    startTime: "07:00",
    endTime: "12:00",
    slotMinutes: 60,
    capacityPerSlot: 1,
    effectiveFrom: "2026-01-01",
    effectiveUntil: null,
    isActive: true,
    ...overrides,
  };
}

// 2026-11-16 is a Monday (day 1) in Manila.
const NOW = new Date("2026-11-15T12:00:00+08:00");

describe("serviceKindOf", () => {
  it("groups laboratory, packages, and every other bookable category", () => {
    expect(serviceKindOf("laboratory")).toBe("lab");
    expect(serviceKindOf("package")).toBe("package");
    expect(serviceKindOf("imaging")).toBe("diagnostics");
    expect(serviceKindOf("cardiac_diagnostics")).toBe("diagnostics");
  });
});

describe("validateServiceSelection (mirrors 0038)", () => {
  it("accepts several walk-in lab tests", () => {
    expect(
      validateServiceSelection([service(), service({ id: "ua", name: "Urinalysis" })]),
    ).toBe(true);
  });

  it("accepts one scheduled service or one package", () => {
    expect(validateServiceSelection([service({ category: "imaging", bookingMode: "scheduled" })])).toBe(
      true,
    );
    expect(validateServiceSelection([service({ category: "package" })])).toBe(true);
  });

  it("refuses an empty list, duplicates, more than 5, and mixing a lab test with anything else", () => {
    expect(validateServiceSelection([])).toBe(false);
    expect(validateServiceSelection([service(), service()])).toBe(false);
    expect(
      validateServiceSelection(
        ["a", "b", "c", "d", "e", "f"].map((id) => service({ id })),
      ),
    ).toBe(false);
    expect(
      validateServiceSelection([
        service(),
        service({ id: "us", category: "imaging", bookingMode: "scheduled" }),
      ]),
    ).toBe(false);
    expect(
      validateServiceSelection([service(), service({ id: "pkg", category: "package" })]),
    ).toBe(false);
  });
});

describe("service charge lines", () => {
  it("gives the pricing doc's PWD CBC + urinalysis + FBS example: ₱520 → ₱416", () => {
    const lines = [
      service({ priceCentavos: 25000 }),
      service({ id: "ua", priceCentavos: 12000 }),
      service({ id: "fbs", priceCentavos: 15000 }),
    ].map(serviceLine);
    const { totals } = computeCharge({ items: lines, privilege: "pwd", payer: "self", hmoCopayCentavos: 0 });
    expect(totals.baseCentavos).toBe(52000);
    expect(totals.amountDueCentavos).toBe(41600);
  });

  it("offers an HMO only when a line is HMO-coverable", () => {
    expect(hmoOffered([serviceLine(service({ hmoCoverable: false }))])).toBe(false);
    expect(
      hmoOffered([serviceLine(service({ hmoCoverable: false })), serviceLine(service())]),
    ).toBe(true);
  });
});

describe("serviceSlots", () => {
  const ultrasound = period({
    serviceId: "us",
    startTime: "08:00",
    endTime: "10:00",
    slotMinutes: 30,
    capacityPerSlot: 2,
  });

  it("walks the period's grid and drops slots at capacity", () => {
    const full = new Date("2026-11-16T08:30:00+08:00");
    const slots = serviceSlots({
      periods: [ultrasound],
      holidays: [],
      load: [{ start: full, bookings: 2 }],
      fromDate: "2026-11-16",
      days: 1,
      now: NOW,
    });
    expect(slots.map((slot) => slot.start.toISOString())).toEqual([
      new Date("2026-11-16T08:00:00+08:00").toISOString(),
      new Date("2026-11-16T09:00:00+08:00").toISOString(),
      new Date("2026-11-16T09:30:00+08:00").toISOString(),
    ]);
  });

  it("keeps a slot below capacity and drops past slots and holidays", () => {
    const slots = serviceSlots({
      periods: [ultrasound],
      holidays: [
        {
          start: new Date("2026-11-16T09:00:00+08:00"),
          end: new Date("2026-11-17T00:00:00+08:00"),
        },
      ],
      load: [{ start: new Date("2026-11-16T08:00:00+08:00"), bookings: 1 }],
      fromDate: "2026-11-16",
      days: 1,
      now: new Date("2026-11-16T08:10:00+08:00"),
    });
    expect(slots.map((slot) => slot.start.toISOString())).toEqual([
      new Date("2026-11-16T08:30:00+08:00").toISOString(),
    ]);
  });
});

describe("walkInDates", () => {
  const cbc = { id: "cbc", dailyCapacity: 2, periods: [period()] };
  const ua = { id: "ua", dailyCapacity: null, periods: [period({ serviceId: "ua", endTime: "11:00" })] };

  it("offers open dates from the first service's opening time and drops full days", () => {
    const dates = walkInDates({
      services: [cbc, ua],
      holidays: [],
      load: [
        { serviceId: "cbc", start: new Date("2026-11-16T07:00:00+08:00"), bookings: 1 },
        { serviceId: "cbc", start: new Date("2026-11-16T07:00:00+08:00"), bookings: 1 },
      ],
      fromDate: "2026-11-16",
      days: 8,
      now: NOW,
    });
    // Mondays only; the 16th is full (2 of 2).
    expect(dates).toEqual([
      {
        date: "2026-11-23",
        start: new Date("2026-11-23T07:00:00+08:00"),
        end: new Date("2026-11-23T12:00:00+08:00"),
      },
    ]);
  });

  it("needs every service to be open that day", () => {
    const dates = walkInDates({
      services: [cbc, { ...ua, periods: [period({ serviceId: "ua", dayOfWeek: 2 })] }],
      holidays: [],
      load: [],
      fromDate: "2026-11-16",
      days: 7,
      now: NOW,
    });
    expect(dates).toEqual([]);
  });

  it("drops a day once it has opened and a holiday", () => {
    const dates = walkInDates({
      services: [cbc],
      holidays: [
        {
          start: new Date("2026-11-23T00:00:00+08:00"),
          end: new Date("2026-11-24T00:00:00+08:00"),
        },
      ],
      load: [],
      fromDate: "2026-11-16",
      days: 14,
      now: new Date("2026-11-16T07:30:00+08:00"),
    });
    // Mondays the 16th (already open) and the 23rd (holiday) in this window.
    expect(dates).toEqual([]);
  });
});
