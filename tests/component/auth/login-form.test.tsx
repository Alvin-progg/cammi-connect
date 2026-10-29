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

  it("shows a generic form error as a toast, not an inline alert", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      formError: "Email or password is incorrect.",
    });
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Sign-in failed", {
        id: "login-error",
        description: "Email or password is incorrect.",
        duration: 8000,
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Email or password is incorrect."),
    ).not.toBeInTheDocument();
  });

  it("uses a stable toast id and an 8 second duration for credential failures", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      formError: "Email or password is incorrect.",
    });
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Sign-in failed", {
        id: "login-error",
        description: "Email or password is incorrect.",
        duration: 8000,
      }),
    );
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
    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled());
    expect(screen.getByLabelText("Email")).toHaveValue("pat@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("shows the callback error as a toast", async () => {
    render(<LoginForm callbackError="Unable to sign in. Please try again." />);
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Sign-in failed", {
        id: "login-error",
        description: "Unable to sign in. Please try again.",
        duration: 8000,
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

  it("links to the registration page", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute(
      "href",
      "/register",
    );
  });
});
