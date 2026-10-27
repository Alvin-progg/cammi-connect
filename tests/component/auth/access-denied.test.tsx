import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccessDenied } from "@/components/auth/access-denied";

describe("AccessDenied", () => {
  it("shows a neutral access-denied state without resource details", () => {
    render(<AccessDenied />);

    expect(
      screen.getByRole("heading", { name: "Access denied" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("This dashboard is only available to doctor accounts."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to your account" }),
    ).toHaveAttribute("href", "/account");
    expect(screen.queryByText(/appointment/i)).not.toBeInTheDocument();
  });
});
