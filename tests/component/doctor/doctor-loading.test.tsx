import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DoctorLoading from "@/app/doctor/loading";
import { DoctorShellLoading } from "@/components/doctor/doctor-shell-loading";

describe("DoctorShellLoading", () => {
  it("announces loading and marks the page region busy", () => {
    render(<DoctorShellLoading />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your dashboard",
    );
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });
});

describe("DoctorLoading", () => {
  it("announces loading without redrawing the layout's rail", () => {
    const { container } = render(<DoctorLoading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(container.querySelector("aside")).toBeNull();
  });
});
