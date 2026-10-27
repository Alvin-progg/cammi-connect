import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import DoctorError from "@/app/doctor/error";

describe("DoctorError", () => {
  it("shows a page-level error without raw details", () => {
    render(<DoctorError error={new Error("raw database detail")} reset={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Dashboard unavailable" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing was changed/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw database detail/i)).not.toBeInTheDocument();
  });

  it("offers a retry and a safe way back to the account page", async () => {
    const reset = vi.fn();
    render(<DoctorError error={new Error("boom")} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("link", { name: "Go to your account" }),
    ).toHaveAttribute("href", "/account");
  });
});
