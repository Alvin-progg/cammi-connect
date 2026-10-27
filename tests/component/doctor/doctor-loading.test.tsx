import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DoctorLoading from "@/app/doctor/loading";

describe("DoctorLoading", () => {
  it("announces loading and marks the page region busy", () => {
    render(<DoctorLoading />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your dashboard",
    );
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });
});
