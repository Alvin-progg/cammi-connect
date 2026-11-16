// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  CHARGED_BOOKING_MESSAGES,
  bookConsultationWithCharge,
  type ChargeStore,
} from "@/server/payments/service";

vi.mock("server-only", () => ({}));

const INPUT = {
  patientId: "00000000-0000-4000-8000-000000000201",
  doctorId: "00000000-0000-4000-8000-0000000000d1",
  specialtyId: "00000000-0000-4000-8000-0000000005a1",
  start: "2026-11-03T01:00:00.000Z",
  reason: null,
  privilege: "senior" as const,
  payment: { payer: "self" as const, method: "qr_ph" as const },
  expectedAmountDueCentavos: 56000,
};

function storeReturning(result: Awaited<ReturnType<ChargeStore["bookWithCharge"]>>): ChargeStore {
  return {
    getConsultationFee: vi.fn(),
    listActiveHmoProviders: vi.fn(),
    bookWithCharge: vi.fn(async () => result),
  };
}

describe("bookConsultationWithCharge (PAY-03)", () => {
  it("passes the booking through and returns the payment", async () => {
    const payment = {
      status: "awaiting_payment" as const,
      amountDueCentavos: 56000,
      referenceCode: "CC-7F3K2",
      deadline: "2026-10-31T03:00:00.000Z",
    };
    const store = storeReturning({ ok: true, appointmentId: "appt-1", payment });

    await expect(bookConsultationWithCharge(INPUT, store)).resolves.toEqual({
      ok: true,
      appointmentId: "appt-1",
      payment,
    });
    expect(store.bookWithCharge).toHaveBeenCalledWith(INPUT);
  });

  it.each([
    ["payment_too_soon", /pick a later time/],
    ["price_changed", /fee for this visit just changed/],
    ["price_on_request", /front desk/],
    ["hmo_unavailable", /HMO/],
    ["too_many_upcoming", /maximum number of upcoming appointments/],
    ["outside_hours", /consultation hours/],
  ])("maps the %s refusal to a patient message", async (code, message) => {
    const result = await bookConsultationWithCharge(
      INPUT,
      storeReturning({ ok: false, error: { code: "P0001", message: code } }),
    );

    expect(result).toEqual({ ok: false, message: expect.stringMatching(message) });
  });

  it("reports a slot taken in the meantime", async () => {
    const result = await bookConsultationWithCharge(
      INPUT,
      storeReturning({ ok: false, error: { code: "23P01", message: "conflict" } }),
    );

    expect(result).toEqual({ ok: false, message: "That slot was just booked. Choose another time." });
  });

  it("throws on an unexpected database error instead of leaking it", async () => {
    await expect(
      bookConsultationWithCharge(
        INPUT,
        storeReturning({ ok: false, error: { code: "XX000", message: "internal detail" } }),
      ),
    ).rejects.toThrow("Unable to book the appointment.");
  });

  it("never names an amount in a refusal message", () => {
    expect(Object.values(CHARGED_BOOKING_MESSAGES).join(" ")).not.toMatch(/₱|\d/);
  });
});
