import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthCard } from "@/components/auth/auth-card";

describe("AuthCard", () => {
  it("renders one h1, a home link, the form slot and the nurse mascot", () => {
    render(
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
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
    expect(screen.getByText("form goes here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Boop the nurse" })).toBeInTheDocument();
  });

  it("puts the nurse and her greeting in the side panel of the split layout", () => {
    render(
      <AuthCard
        variant="split"
        title="Welcome back"
        greeting={{ title: "Good to see you again!", text: "I'll look away." }}
      >
        <p>form</p>
      </AuthCard>,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Boop the nurse" })).toHaveLength(1);
    expect(screen.getByText("Good to see you again!")).toBeInTheDocument();
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
