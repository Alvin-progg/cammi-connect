import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppointmentFilters } from "@/components/appointments/appointment-filters";

describe("AppointmentFilters", () => {
  it("renders labeled date and status controls with the current values", () => {
    render(
      <AppointmentFilters
        filters={{ date: "2026-10-25", status: "confirmed" }}
      />,
    );

    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-25");
    expect(screen.getByLabelText("Status")).toHaveValue("confirmed");
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeInTheDocument();
  });

  it("submits the filters as a GET request to the dashboard", () => {
    render(
      <AppointmentFilters filters={{ date: "2026-10-25", status: null }} />,
    );

    const form = screen.getByRole("button", { name: "Apply filters" }).closest("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/doctor");
    expect(screen.getByLabelText("Status")).toHaveValue("all");
  });

  it("offers a reset link back to the unfiltered dashboard", () => {
    render(
      <AppointmentFilters filters={{ date: "2026-10-25", status: null }} />,
    );

    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute(
      "href",
      "/doctor",
    );
  });
});
