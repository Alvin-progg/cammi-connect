import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingCard, type BookingPayload } from "@/components/chat/booking-cards";

const CBC_ID = "00000000-0000-4000-8000-0000000c0001";
const UA_ID = "00000000-0000-4000-8000-0000000c0002";
const FAMILY_ID = "00000000-0000-4000-8000-0000000005a2";
// Tuesday 2026-11-03, 07:00–12:00 Manila.
const WALK_IN = { start: "2026-11-02T23:00:00.000Z", end: "2026-11-03T04:00:00.000Z" };

function renderCard(payload: BookingPayload) {
  const onEvent = vi.fn();
  render(<BookingCard payload={payload} interactive busy={false} onEvent={onEvent} />);
  return onEvent;
}

describe("PAY-07 service cards", () => {
  it("offers lab tests, imaging, and packages next to the specialties", () => {
    const onEvent = renderCard({
      kind: "specialty_options",
      specialties: [{ id: FAMILY_ID, name: "Family Medicine" }],
      serviceKinds: ["lab", "diagnostics", "package"],
    });

    fireEvent.click(screen.getByRole("button", { name: "Lab tests" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_service_kind", serviceKind: "lab" });
    expect(screen.getByRole("button", { name: "Imaging and diagnostics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check-up packages" })).toBeInTheDocument();
  });

  it("sends several lab tests together, in the order they were ticked", () => {
    const onEvent = renderCard({
      kind: "service_options",
      multiple: true,
      services: [
        { id: CBC_ID, name: "CBC with platelet count", requiresDoctorRequest: true },
        { id: UA_ID, name: "Urinalysis", requiresDoctorRequest: false },
      ],
    });

    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Urinalysis/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /CBC with platelet count/ }));
    expect(screen.getByText("Needs a doctor's request")).toBeInTheDocument();
    fireEvent.click(next);
    expect(onEvent).toHaveBeenCalledWith({ type: "select_services", serviceIds: [UA_ID, CBC_ID] });
  });

  it("sends a single imaging test or package at once", () => {
    const onEvent = renderCard({
      kind: "service_options",
      multiple: false,
      services: [{ id: CBC_ID, name: "Whole abdomen ultrasound", requiresDoctorRequest: false }],
    });

    fireEvent.click(screen.getByRole("button", { name: /Whole abdomen ultrasound/ }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_services", serviceIds: [CBC_ID] });
  });

  it("shows walk-in days as arrival times", () => {
    const onEvent = renderCard({
      kind: "slot_picker",
      doctorName: "CBC with platelet count",
      walkIn: true,
      days: [{ date: "2026-11-03", slots: [WALK_IN] }],
      nextFromDate: null,
      alternatives: [],
    });

    fireEvent.click(screen.getByRole("button", { name: /From 7:00 AM/ }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_slot", start: WALK_IN.start });
    expect(screen.getByText(/first come, first served/i)).toBeInTheDocument();
  });

  it("lists requirements above the discount question", () => {
    renderCard({
      kind: "privilege_options",
      pwdVerified: true,
      requirements: [
        { serviceName: "Urinalysis", title: "Clean-catch midstream sample", description: null },
      ],
    });
    expect(screen.getByRole("list", { name: "What to prepare" })).toHaveTextContent(
      "Urinalysis: Clean-catch midstream sample",
    );
  });

  it("summarizes a service visit without a doctor and lets the patient change the tests", () => {
    const onEvent = renderCard({
      kind: "booking_summary",
      doctorName: "CBC with platelet count + Urinalysis",
      specialtyName: null,
      start: WALK_IN.start,
      end: WALK_IN.end,
      reason: null,
      services: ["CBC with platelet count", "Urinalysis"],
      walkIn: true,
      charge: {
        privilege: "pwd",
        payerLabel: "I'll pay (GCash, Maya, bank)",
        baseCentavos: 37000,
        vatExemptionCentavos: 0,
        privilegeDiscountCentavos: 7400,
        philhealthCentavos: 0,
        hmoCentavos: 0,
        amountDueCentavos: 29600,
      },
    });

    expect(screen.queryByText("Doctor")).not.toBeInTheDocument();
    expect(screen.getByText("CBC with platelet count, Urinalysis")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change doctor" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change tests" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "change_booking", field: "service" });
  });

  it("says the front desk confirms a service visit", () => {
    renderCard({
      kind: "booking_result",
      doctorName: "Whole abdomen ultrasound",
      start: WALK_IN.start,
      end: WALK_IN.end,
      services: ["Whole abdomen ultrasound"],
      walkIn: false,
    });
    expect(screen.getByText("Awaiting front desk confirmation.")).toBeInTheDocument();
    expect(screen.queryByText(/doctor's confirmation/)).not.toBeInTheDocument();
  });
});
