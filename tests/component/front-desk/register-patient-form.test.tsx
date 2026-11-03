import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterPatientForm } from "@/components/front-desk/register-patient-form";
import { registerPatientAction } from "@/server/front-desk/actions";

vi.mock("@/server/front-desk/actions", () => ({ registerPatientAction: vi.fn() }));

beforeEach(() => {
  vi.mocked(registerPatientAction).mockReset();
});

describe("RegisterPatientForm", () => {
  it("requires a name and a phone number", () => {
    render(<RegisterPatientForm />);

    expect(screen.getByRole("textbox", { name: "Full name" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "Phone number" })).toBeRequired();
    expect(
      screen.getByText(/No CamiConnect login is created/),
    ).toBeInTheDocument();
  });

  it("submits the name and phone", async () => {
    vi.mocked(registerPatientAction).mockResolvedValue({ status: "idle" });
    const user = userEvent.setup();
    render(<RegisterPatientForm />);

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Test Walkin");
    await user.type(screen.getByRole("textbox", { name: "Phone number" }), "0900 000 0000");
    await user.click(screen.getByRole("button", { name: "Register patient" }));

    await waitFor(() => expect(registerPatientAction).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(registerPatientAction).mock.calls[0][1];
    expect(submitted.get("fullName")).toBe("Test Walkin");
    expect(submitted.get("phone")).toBe("0900 000 0000");
  });

  it("shows why registration failed", async () => {
    vi.mocked(registerPatientAction).mockResolvedValue({
      status: "error",
      message:
        "A patient with this phone number is already registered. Search for them instead.",
    });
    const user = userEvent.setup();
    render(<RegisterPatientForm />);

    await user.type(screen.getByRole("textbox", { name: "Full name" }), "Test Walkin");
    await user.type(screen.getByRole("textbox", { name: "Phone number" }), "09000000000");
    await user.click(screen.getByRole("button", { name: "Register patient" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A patient with this phone number is already registered.",
    );
  });
});
