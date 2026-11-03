import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { loginAction } from "@/server/auth/actions";

vi.mock("@/server/auth/actions", () => ({ loginAction: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderLoginPage() {
  const view = render(
    <AuthCard title="Welcome back!">
      <LoginForm />
    </AuthCard>,
  );
  const illustration = view.container.querySelector(
    '[data-testid="hospital-illustration"]',
  );
  if (!illustration) throw new Error("illustration not rendered");
  return illustration;
}

function nurse() {
  return screen.getByRole("button", { name: "Boop the nurse" });
}

describe("auth mascots", () => {
  it("are idle until the user interacts", () => {
    const illustration = renderLoginPage();
    expect(illustration).toHaveAttribute("data-mood", "idle");
    expect(nurse()).toHaveAttribute("data-direction", "center");
    expect(nurse()).not.toHaveAttribute("data-reaction");
  });

  it("are curious while the user types an email or a hidden password", async () => {
    const user = userEvent.setup();
    const illustration = renderLoginPage();

    await user.type(screen.getByLabelText("Email"), "pat@example.com");
    expect(illustration).toHaveAttribute("data-mood", "curious");
    expect(nurse()).toHaveAttribute("data-direction", "down");

    await user.click(screen.getByLabelText("Password"));
    expect(illustration).toHaveAttribute("data-mood", "curious");
  });

  it("look away when the password is shown, and come back when it is hidden", async () => {
    const user = userEvent.setup();
    const illustration = renderLoginPage();

    await user.click(screen.getByLabelText("Password"));
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(illustration).toHaveAttribute("data-mood", "look-away");
    expect(nurse()).toHaveAttribute("data-reaction", "bashful");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(illustration).toHaveAttribute("data-mood", "curious");
  });

  it("disapprove after a failed sign-in until the user types again", async () => {
    const user = userEvent.setup();
    vi.mocked(loginAction).mockResolvedValue({
      formError: "Email or password is incorrect.",
    });
    const illustration = renderLoginPage();

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(illustration).toHaveAttribute("data-mood", "disapprove"),
    );
    expect(nurse()).toHaveAttribute("data-reaction", "dizzy");

    await user.type(screen.getByLabelText("Password"), "x");
    expect(illustration).toHaveAttribute("data-mood", "curious");
  });
});
