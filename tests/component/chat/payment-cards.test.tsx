import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingCard, type BookingPayload } from "@/components/chat/booking-cards";

const MEMBERSHIP_ID = "00000000-0000-4000-8000-00000000b0b1";
const MEMBERSHIP = { patientHmoId: MEMBERSHIP_ID, name: "Maxicare", maskedNumber: "••••4417" };
const SLOT = { start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:30:00.000Z" };

function renderCard(payload: BookingPayload) {
  const onEvent = vi.fn();
  render(<BookingCard payload={payload} interactive busy={false} onEvent={onEvent} />);
  return onEvent;
}

describe("PAY-03 payment cards", () => {
  it("sends one discount choice", () => {
    const onEvent = renderCard({ kind: "privilege_options", pwdVerified: true });

    fireEvent.click(screen.getByRole("button", { name: "Senior citizen (60+)" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_privilege", privilege: "senior" });
    fireEvent.click(screen.getByRole("button", { name: "PWD" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_privilege", privilege: "pwd" });
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_privilege", privilege: "none" });
  });

  it("offers the PWD discount only once the declaration is verified", () => {
    renderCard({ kind: "privilege_options", pwdVerified: false });

    expect(screen.getByRole("button", { name: "Senior citizen (60+)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "PWD" })).not.toBeInTheDocument();
  });

  it("offers self-pay by QR, HMO, and hides PhilHealth, and hides PhilHealth without a benefit", () => {
    const onEvent = renderCard({
      kind: "payer_options",
      philhealth: false,
      hmoMemberships: [MEMBERSHIP],
    });

    expect(screen.queryByRole("button", { name: "PhilHealth" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I'll pay (GCash, Maya, bank)" }));
    expect(onEvent).toHaveBeenCalledWith({
      type: "select_payer",
      payment: { payer: "self", method: "qr_ph" },
    });
    expect(screen.queryByRole("button", { name: "Pay at the hospital" })).not.toBeInTheDocument();
  });

  it("lets the patient pick a saved HMO membership, with no member number to type", () => {
    const onEvent = renderCard({
      kind: "payer_options",
      philhealth: true,
      hmoMemberships: [MEMBERSHIP],
    });

    expect(screen.getByRole("button", { name: "PhilHealth" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "My HMO" }));
    expect(screen.queryByLabelText("Member number")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("HMO membership"), { target: { value: MEMBERSHIP_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Use my HMO" }));

    expect(onEvent).toHaveBeenCalledWith({
      type: "select_payer",
      payment: { payer: "hmo", patientHmoId: MEMBERSHIP_ID },
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
