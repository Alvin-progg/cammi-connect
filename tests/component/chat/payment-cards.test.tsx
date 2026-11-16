import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingCard, type BookingPayload } from "@/components/chat/booking-cards";

const MAXICARE_ID = "00000000-0000-4000-8000-00000000a0a1";
const SLOT = { start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:30:00.000Z" };

function renderCard(payload: BookingPayload) {
  const onEvent = vi.fn();
  render(<BookingCard payload={payload} interactive busy={false} onEvent={onEvent} />);
  return onEvent;
}

describe("PAY-03 payment cards", () => {
  it("sends one discount choice", () => {
    const onEvent = renderCard({ kind: "privilege_options" });

    fireEvent.click(screen.getByRole("button", { name: "Senior citizen (60+)" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_privilege", privilege: "senior" });
    fireEvent.click(screen.getByRole("button", { name: "PWD" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_privilege", privilege: "pwd" });
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_privilege", privilege: "none" });
  });

  it("offers self-pay, pay at the hospital, and HMO, and hides PhilHealth without a benefit", () => {
    const onEvent = renderCard({
      kind: "payer_options",
      philhealth: false,
      hmoProviders: [{ id: MAXICARE_ID, name: "Maxicare" }],
    });

    expect(screen.queryByRole("button", { name: "PhilHealth" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I'll pay (GCash, Maya, bank)" }));
    expect(onEvent).toHaveBeenCalledWith({
      type: "select_payer",
      payment: { payer: "self", method: "qr_ph" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pay at the hospital" }));
    expect(onEvent).toHaveBeenCalledWith({
      type: "select_payer",
      payment: { payer: "self", method: "counter" },
    });
  });

  it("asks for the HMO and member number before sending an HMO choice", () => {
    const onEvent = renderCard({
      kind: "payer_options",
      philhealth: true,
      hmoProviders: [{ id: MAXICARE_ID, name: "Maxicare" }],
    });

    expect(screen.getByRole("button", { name: "PhilHealth" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "My HMO" }));
    fireEvent.change(screen.getByLabelText("HMO"), { target: { value: MAXICARE_ID } });
    fireEvent.change(screen.getByLabelText("Member number"), { target: { value: "12344417" } });
    fireEvent.click(screen.getByRole("button", { name: "Use my HMO" }));

    expect(onEvent).toHaveBeenCalledWith({
      type: "select_payer",
      payment: { payer: "hmo", hmoProviderId: MAXICARE_ID, memberNumber: "12344417" },
    });
  });

  it("shows the breakdown and the amount to pay on the summary", () => {
    const onEvent = renderCard({
      kind: "booking_summary",
      doctorName: "Dr. Maya Santos",
      specialtyName: "Cardiology",
      ...SLOT,
      reason: null,
      charge: {
        privilege: "senior",
        payerLabel: "I'll pay (GCash, Maya, bank)",
        baseCentavos: 70000,
        vatExemptionCentavos: 0,
        privilegeDiscountCentavos: 14000,
        philhealthCentavos: 0,
        hmoCentavos: 0,
        amountDueCentavos: 56000,
      },
    });

    const breakdown = within(screen.getByRole("group", { name: "Price breakdown" }));
    expect(breakdown.getByText("₱700.00")).toBeInTheDocument();
    expect(breakdown.getByText("−₱140.00")).toBeInTheDocument();
    expect(breakdown.getByText("₱560.00")).toBeInTheDocument();
    expect(breakdown.getByText("Amount to pay")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Change discount or payment" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "change_booking", field: "payment" });
  });

  it("shows the amount, reference code, and status after booking", () => {
    renderCard({
      kind: "booking_result",
      doctorName: "Dr. Maya Santos",
      ...SLOT,
      payment: {
        status: "awaiting_payment",
        amountDueCentavos: 56000,
        referenceCode: "CC-7F3K2",
        deadline: "2026-10-31T08:30:00.000Z",
      },
    });

    expect(screen.getByText("₱560.00")).toBeInTheDocument();
    expect(screen.getByText("CC-7F3K2")).toBeInTheDocument();
    expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
  });
});
