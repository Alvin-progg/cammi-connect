import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import AdminError from "@/app/admin/error";

describe("AdminError", () => {
  it("shows a page-level error without raw details and offers a retry", async () => {
    const reset = vi.fn();
    render(<AdminError error={new Error("raw database detail")} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: "Administration unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw database detail/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
