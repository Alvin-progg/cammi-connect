import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import { loginAction } from "@/server/auth/actions";
import type { AuthFormState } from "@/lib/auth/form-state";

vi.mock("@/server/auth/actions", () => ({ loginAction: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoginForm", () => {
  it("renders labeled email and password fields with autocomplete hints", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows field errors returned by the action", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      fieldErrors: { email: ["Enter a valid email address."] },
    });
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
  });

  // Redesign (user-approved spec): a sign-in failure shows a destructive
  // Alert above the fields with the same message for every failure, not a toast.
  it("shows a sign-in failure as an inline alert above the fields, not a toast", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      formError: "Email or password is incorrect.",
    });
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Email or password is incorrect.");
    expect(
      alert.compareDocumentPosition(screen.getByLabelText("Email")) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it("does not toast field validation errors", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      fieldErrors: { email: ["Enter a valid email address."] },
    });
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it("moves focus to the first invalid field after a validation failure", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      fieldErrors: {
        email: ["Enter a valid email address."],
        password: ["Enter your password."],
      },
    });
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });

  it("disables the submit button and shows pending text while submitting", async () => {
    const user = userEvent.setup();
    let resolvePending: ((state: AuthFormState) => void) | undefined;
    vi.mocked(loginAction).mockImplementation(
      () =>
        new Promise<AuthFormState>((resolve) => {
          resolvePending = resolve;
        }),
    );
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    const button = screen.getByRole("button", { name: "Signing in…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    resolvePending?.({});
    await screen.findByRole("button", { name: "Sign in" });
  });

  it("preserves the email but never the password after a failed submit", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      formError: "Email or password is incorrect.",
    });
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Email"), "pat@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Email")).toHaveValue("pat@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("shows the callback error as an inline alert", () => {
    render(<LoginForm callbackError="Unable to sign in. Please try again." />);

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to sign in. Please try again.");
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it("offers patient registration and explains staff accounts", () => {
    render(<LoginForm />);

    expect(screen.getByRole("link", { name: "Create a patient account" })).toHaveAttribute("href", "/register");
    expect(screen.getByText(/Staff accounts are created by an administrator/)).toBeInTheDocument();
  });

  it("ties a field error to its input with an explicit Error prefix", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      fieldErrors: { email: ["Enter a valid email address."] },
    });
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Enter a valid email address.");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "Error: Enter a valid email address.",
    );
  });

  it("reveals and hides the password with a labelled toggle", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

});
