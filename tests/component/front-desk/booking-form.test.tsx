import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingForm } from "@/components/front-desk/booking-form";
import { bookForPatientAction } from "@/server/front-desk/actions";

vi.mock("@/server/front-desk/actions", () => ({ bookForPatientAction: vi.fn() }));

const PATIENT_ID = "00000000-0000-4000-8000-000000000401";
const DOCTOR_ID = "00000000-0000-4000-8000-000000000101";
const SPECIALTY_ID = "00000000-0000-4000-8000-000000000501";

// 9:00 and 9:30 AM in Manila on 2026-11-05.
const SLOTS = [
  { start: "2026-11-05T01:00:00.000Z", end: "2026-11-05T01:30:00.000Z" },
  { start: "2026-11-05T01:30:00.000Z", end: "2026-11-05T02:00:00.000Z" },
];

function renderForm(slots = SLOTS) {
  return render(
    <BookingForm
      patientId={PATIENT_ID}
      patientName="Test Walkin"
      doctorId={DOCTOR_ID}
      doctorName="Dr. Synthetic"
      specialtyId={SPECIALTY_ID}
      dateLabel="Nov 5, 2026"
      slots={slots}
    />,
  );
}

beforeEach(() => {
  vi.mocked(bookForPatientAction).mockReset();
});

describe("BookingForm", () => {
  it("offers the doctor's free slots as Manila times", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "9:00 AM" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "9:30 AM" })).toBeInTheDocument();
  });

  it("says when the doctor has no free slots on the date", () => {
    renderForm([]);

    expect(
      screen.getByText("No free slots on this date. Choose another date."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book and confirm" })).toBeNull();
  });

  it("reviews the chosen slot before booking", async () => {
    const user = userEvent.setup();
    renderForm();

    const review = screen.getByRole("region", { name: "Review" });
    expect(review).toHaveTextContent("Test Walkin");
    expect(review).toHaveTextContent("Dr. Synthetic");
    expect(review).toHaveTextContent("Nov 5, 2026");
    expect(review).toHaveTextContent("Choose a time");

    await user.click(screen.getByRole("radio", { name: "9:30 AM" }));

    expect(review).toHaveTextContent("9:30 AM");
  });

  it("submits the patient, doctor, specialty, slot, and reason", async () => {
    vi.mocked(bookForPatientAction).mockResolvedValue({ status: "idle" });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "9:00 AM" }));
    await user.type(
      screen.getByRole("textbox", { name: "Reason for visit (optional)" }),
      "Follow-up",
    );
    await user.click(screen.getByRole("button", { name: "Book and confirm" }));

    await waitFor(() => expect(bookForPatientAction).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(bookForPatientAction).mock.calls[0][1];
    expect(submitted.get("patientId")).toBe(PATIENT_ID);
    expect(submitted.get("doctorId")).toBe(DOCTOR_ID);
    expect(submitted.get("specialtyId")).toBe(SPECIALTY_ID);
    expect(submitted.get("scheduledAt")).toBe("2026-11-05T01:00:00.000Z");
    expect(submitted.get("reason")).toBe("Follow-up");
    expect(submitted.has("staffId")).toBe(false);
  });

  it("shows why the booking failed", async () => {
    vi.mocked(bookForPatientAction).mockResolvedValue({
      status: "error",
      message: "That slot was just taken. Choose another time.",
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "9:00 AM" }));
    await user.click(screen.getByRole("button", { name: "Book and confirm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That slot was just taken. Choose another time.",
    );
  });
});
