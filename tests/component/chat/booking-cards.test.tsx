import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookingCard, type BookingPayload } from "@/components/chat/booking-cards";
import { formatManilaTime } from "@/lib/appointments/format";

const CARDIOLOGY_ID = "00000000-0000-4000-8000-0000000005a1";
const MAYA_ID = "00000000-0000-4000-8000-0000000000d1";
const JOSE_ID = "00000000-0000-4000-8000-0000000000d2";
const SLOT_ONE = { start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:30:00.000Z" };
const SLOT_TWO = { start: "2026-11-03T01:30:00.000Z", end: "2026-11-03T02:00:00.000Z" };
const SLOT_THREE = { start: "2026-11-04T02:00:00.000Z", end: "2026-11-04T02:30:00.000Z" };

function renderCard(
  payload: BookingPayload,
  props: Partial<{ interactive: boolean; busy: boolean }> = {},
) {
  const onEvent = vi.fn();
  render(
    <BookingCard
      payload={payload}
      interactive={props.interactive ?? true}
      busy={props.busy ?? false}
      onEvent={onEvent}
    />,
  );
  return onEvent;
}

describe("BookingCard", () => {
  it("sends the chosen specialty", () => {
    const onEvent = renderCard({
      kind: "specialty_options",
      specialties: [{ id: CARDIOLOGY_ID, name: "Cardiology" }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Cardiology" }));

    expect(onEvent).toHaveBeenCalledWith({ type: "select_specialty", specialtyId: CARDIOLOGY_ID });
  });

  it("shows doctor cards from the payload and sends the chosen doctor", () => {
    const onEvent = renderCard({
      kind: "doctor_options",
      doctors: [
        {
          id: MAYA_ID,
          name: "Dr. Maya Santos",
          departmentName: "Heart Center",
          specialties: ["Cardiology"],
        },
      ],
    });

    expect(screen.getByText("Heart Center · Cardiology")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Choose Dr\. Maya Santos/ }));

    expect(onEvent).toHaveBeenCalledWith({ type: "select_doctor", doctorId: MAYA_ID });
  });

  it("groups slots by date with 44px buttons and marks the picked slot as selected", () => {
    const onEvent = renderCard({
      kind: "slot_picker",
      doctorName: "Dr. Maya Santos",
      days: [
        { date: "2026-11-03", slots: [SLOT_ONE, SLOT_TWO] },
        { date: "2026-11-04", slots: [SLOT_THREE] },
      ],
      nextFromDate: "2026-11-07",
      alternatives: [],
    });

    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(2);
    const firstDay = within(groups[0]).getAllByRole("button");
    expect(firstDay).toHaveLength(2);
    expect(firstDay[0].className).toContain("min-h-11");

    fireEvent.click(screen.getByRole("button", { name: new RegExp(formatManilaTime(SLOT_TWO.start)) }));

    expect(onEvent).toHaveBeenCalledWith({ type: "select_slot", start: SLOT_TWO.start });
    const picked = within(groups[0]).getAllByRole("button")[1];
    expect(picked).toHaveAttribute("aria-pressed", "true");
    expect(picked.className).toContain("border-2");
    expect(picked.className).toContain("border-primary");
    expect(screen.getByText(/Asia\/Manila/)).toBeInTheDocument();
  });

  it("offers later dates and other doctors when the window is empty", () => {
    const onEvent = renderCard({
      kind: "slot_picker",
      doctorName: "Dr. Maya Santos",
      days: [],
      nextFromDate: "2026-11-07",
      alternatives: [
        { id: JOSE_ID, name: "Dr. José Santos", departmentName: null, specialties: ["Cardiology"] },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Show later dates" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "more_slots", fromDate: "2026-11-07" });

    fireEvent.click(screen.getByRole("button", { name: /Choose Dr\. José Santos/ }));
    expect(onEvent).toHaveBeenCalledWith({ type: "select_doctor", doctorId: JOSE_ID });
  });

  it("hides the later-dates action at the booking horizon", () => {
    renderCard({
      kind: "slot_picker",
      doctorName: "Dr. Maya Santos",
      days: [{ date: "2026-11-03", slots: [SLOT_ONE] }],
      nextFromDate: null,
      alternatives: [],
    });

    expect(screen.queryByRole("button", { name: "Show later dates" })).not.toBeInTheDocument();
  });

  it("summarises the request with Confirm and Change actions", () => {
    const onEvent = renderCard({
      kind: "booking_summary",
      doctorName: "Dr. Maya Santos",
      specialtyName: "Cardiology",
      start: SLOT_ONE.start,
      end: SLOT_ONE.end,
      reason: "Follow-up",
    });

    expect(screen.getByText("Dr. Maya Santos")).toBeInTheDocument();
    expect(screen.getByText("Follow-up")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Change time" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "change_booking", field: "slot" });

    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    expect(onEvent).toHaveBeenCalledWith({ type: "confirm_booking" });
  });

  it("shows a specific pending label on Confirm while the request runs", () => {
    const onEvent = vi.fn();
    const payload: BookingPayload = {
      kind: "booking_summary",
      doctorName: "Dr. Maya Santos",
      specialtyName: null,
      start: SLOT_ONE.start,
      end: SLOT_ONE.end,
      reason: null,
    };
    const { rerender } = render(
      <BookingCard payload={payload} interactive busy={false} onEvent={onEvent} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));
    rerender(<BookingCard payload={payload} interactive busy onEvent={onEvent} />);

    const pending = screen.getByRole("button", { name: "Booking…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-busy", "true");
  });

  it("disables every action on an earlier card or while a request is pending", () => {
    const payload: BookingPayload = {
      kind: "booking_summary",
      doctorName: "Dr. Maya Santos",
      specialtyName: null,
      start: SLOT_ONE.start,
      end: SLOT_ONE.end,
      reason: null,
    };

    const { unmount } = render(
      <BookingCard payload={payload} interactive={false} busy={false} onEvent={vi.fn()} />,
    );
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    unmount();

    render(<BookingCard payload={payload} interactive busy onEvent={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("says the request was received, never that it is confirmed", () => {
    renderCard({
      kind: "booking_result",
      doctorName: "Dr. Maya Santos",
      start: SLOT_ONE.start,
      end: SLOT_ONE.end,
    });

    expect(screen.getByText("Request received")).toBeInTheDocument();
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.queryByText(/confirmed/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View my appointments" })).toHaveAttribute(
      "href",
      "/chat?view=appointments",
    );
  });

  it("renders doctor names as text, never as markup", () => {
    renderCard({
      kind: "doctor_options",
      doctors: [
        {
          id: MAYA_ID,
          name: "<img src=x onerror=alert(1)>",
          departmentName: null,
          specialties: [],
        },
      ],
    });

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
