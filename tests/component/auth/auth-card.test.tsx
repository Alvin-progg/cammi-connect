import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthCard } from "@/components/auth/auth-card";

describe("AuthCard", () => {
  it("renders one h1, a home link, the form slot and a decorative illustration", () => {
    const { container } = render(
      <AuthCard title="Welcome back!" subtitle="Please enter your details.">
        <p>form goes here</p>
      </AuthCard>,
    );

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Welcome back!");
    expect(screen.getByText("Please enter your details.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CamiConnect" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText("form goes here")).toBeInTheDocument();

    const illustration = container.querySelector(
      '[data-testid="hospital-illustration"]',
    );
    expect(illustration).not.toBeNull();
    expect(illustration).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the note when given", () => {
    render(
      <AuthCard title="Sign in" note="Accounts are provided by the hospital.">
        <p>form</p>
      </AuthCard>,
    );

    expect(
      screen.getByText("Accounts are provided by the hospital."),
    ).toBeInTheDocument();
  });
});
