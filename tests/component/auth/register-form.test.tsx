import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/components/auth/register-form";
import { registerAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

vi.mock("@/server/auth/actions", () => ({ registerAction: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RegisterForm", () => {
  it("renders labeled fields with autocomplete hints", () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getAllByLabelText(/password/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("shows field errors returned by the action", async () => {
    const user = userEvent.setup();
    vi.mocked(registerAction).mockResolvedValue({
      fieldErrors: { confirmPassword: ["Passwords do not match."] },
    });
    render(<RegisterForm />);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("disables the submit button and shows pending text while submitting", async () => {
    const user = userEvent.setup();
    let resolvePending: ((state: AuthFormState) => void) | undefined;
    vi.mocked(registerAction).mockImplementation(
      () =>
        new Promise<AuthFormState>((resolve) => {
          resolvePending = resolve;
        }),
    );
    render(<RegisterForm />);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    const button = screen.getByRole("button", { name: "Creating account…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    resolvePending?.({});
    await screen.findByRole("button", { name: "Create account" });
  });

  it("shows the neutral confirmation message and hides the form on success", async () => {
    const user = userEvent.setup();
    vi.mocked(registerAction).mockResolvedValue({
      success: "If an account can be created for this email, check your inbox.",
    });
    render(<RegisterForm />);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByText(
        "If an account can be created for this email, check your inbox.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create account" })).not.toBeInTheDocument();
  });

  it("preserves the full name and email but never the passwords after a failed submit", async () => {
    const user = userEvent.setup();
    vi.mocked(registerAction).mockResolvedValue({
      formError: "Unable to sign in right now.",
    });
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Full name"), "Pat Doe");
    await user.type(screen.getByLabelText("Email"), "pat@example.com");
    const [password, confirmPassword] = screen.getAllByLabelText(/password/i);
    await user.type(password, "secret123");
    await user.type(confirmPassword, "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("Pat Doe");
    expect(screen.getByLabelText("Email")).toHaveValue("pat@example.com");
    expect(password).toHaveValue("");
    expect(confirmPassword).toHaveValue("");
  });

  it("links to the login page", () => {
    render(<RegisterForm />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
