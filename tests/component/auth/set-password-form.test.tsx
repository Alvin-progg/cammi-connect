import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SetPasswordForm } from "@/components/auth/set-password-form";
import { updatePasswordAction } from "@/server/auth/actions";

vi.mock("@/server/auth/actions", () => ({ updatePasswordAction: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SetPasswordForm", () => {
  it("asks for a new password twice with new-password autocomplete", () => {
    render(<SetPasswordForm />);

    expect(screen.getByLabelText("New password")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getByLabelText("New password")).toHaveAccessibleDescription(
      "Use at least 6 characters.",
    );
    expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByRole("button", { name: "Set password" })).toBeInTheDocument();
  });

  it("shows field errors and form errors from the action", async () => {
    const user = userEvent.setup();
    vi.mocked(updatePasswordAction).mockResolvedValue({
      fieldErrors: { confirmPassword: ["Passwords do not match."] },
      formError: "Choose a password you have not used before.",
    });
    render(<SetPasswordForm />);

    await user.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a password you have not used before.",
    );
  });
});
