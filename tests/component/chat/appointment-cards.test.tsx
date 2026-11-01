import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AppointmentCard,
  isAppointmentPayload,
  type AppointmentPayload,
} from "@/components/chat/appointment-cards";
import { formatManilaTime } from "@/lib/appointments/format";

const APPOINTMENT_ID = "00000000-0000-4000-8000-000000000301";
const START = "2026-11-03T01:00:00.000Z";

function renderCard(
  payload: AppointmentPayload,
  props: Partial<{ interactive: boolean; busy: boolean }> = {},
) {
  const onEvent = vi.fn();
  const view = render(
    <AppointmentCard
      payload={payload}
      interactive={props.interactive ?? true}
      busy={props.busy ?? false}
      onEvent={onEvent}
    />,
  );
  return { onEvent, ...view };
}

const LIST: AppointmentPayload = {
  kind: "appointments",
  items: [
    {
      id: APPOINTMENT_ID,
      doctorName: "Dr. Maya Santos",
      departmentName: "Cardiology",
      start: START,
      durationMinutes: 30,
      status: "confirmed",
    },
  ],
};

describe("AppointmentCard", () => {
  it("recognises only appointment payloads", () => {
    expect(isAppointmentPayload(LIST)).toBe(true);
    expect(isAppointmentPayload({ kind: "not_verified" })).toBe(false);
  });

  it("lists appointments from the payload and asks to cancel the chosen one", () => {
    const { onEvent } = renderCard(LIST);

    expect(screen.getByText("Dr. Maya Santos")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(formatManilaTime(START)))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel appointment with Dr\. Maya Santos/ }));

    expect(onEvent).toHaveBeenCalledWith({
      type: "request_cancellation",
      appointmentId: APPOINTMENT_ID,
    });
  });

  it("disables Cancel on an earlier card or while a request is in flight", () => {
    const { rerender, onEvent } = renderCard(LIST, { interactive: false });
    expect(screen.getByRole("button", { name: /Cancel appointment/ })).toBeDisabled();

    rerender(<AppointmentCard payload={LIST} interactive busy onEvent={onEvent} />);
    expect(screen.getByRole("button", { name: /Cancel appointment/ })).toBeDisabled();
  });

  it("confirms the cancellation once", () => {
    const payload: AppointmentPayload = {
      kind: "cancel_confirmation",
      appointmentId: APPOINTMENT_ID,
      doctorName: "Dr. Maya Santos",
      start: START,
    };
    const { onEvent, rerender } = renderCard(payload);

    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel it" }));
    rerender(<AppointmentCard payload={payload} interactive busy onEvent={onEvent} />);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "confirm_cancellation",
      appointmentId: APPOINTMENT_ID,
    });
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
  });

  it("keeps the appointment without a server call", () => {
    const { onEvent } = renderCard({
      kind: "cancel_confirmation",
      appointmentId: APPOINTMENT_ID,
      doctorName: "Dr. Maya Santos",
      start: START,
    });

    fireEvent.click(screen.getByRole("button", { name: "Keep appointment" }));

    expect(onEvent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Yes, cancel it" })).toBeDisabled();
    expect(screen.getByText("Your appointment was kept.")).toBeInTheDocument();
  });

  it("shows the cancellation result", () => {
    renderCard({ kind: "cancel_result", doctorName: "Dr. Maya Santos", start: START });

    expect(screen.getByText("Appointment cancelled")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders names as inert text", () => {
    const { container } = renderCard({
      ...LIST,
      items: [{ ...LIST.items[0], doctorName: "<img src=x onerror=alert(1)>" }],
    });

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });
});
