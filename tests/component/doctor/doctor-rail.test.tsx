import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DoctorRail } from "@/components/doctor/doctor-rail";

const pathname = vi.hoisted(() => ({ value: "/doctor" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

vi.mock("@/server/auth/actions", () => ({
  signOutAction: vi.fn(),
}));

function renderRail(path = "/doctor") {
  pathname.value = path;
  return render(
    <DoctorRail doctorName="Dr. Synthetic Doctor" specialty="Cardiology" />,
  );
}

describe("DoctorRail", () => {
  it("starts collapsed and expands from the toggle", async () => {
    const user = userEvent.setup();
    renderRail();

    const toggle = screen.getByRole("button", { name: "Expand menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: "Collapse menu" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("links each view to its own route", () => {
    renderRail();
    expect(screen.getByRole("link", { name: /Appointments/ })).toHaveAttribute("href", "/doctor");
    expect(screen.getByRole("link", { name: /Availability/ })).toHaveAttribute(
      "href",
      "/doctor/schedule",
    );
    expect(screen.getByRole("link", { name: /Statistics/ })).toHaveAttribute(
      "href",
      "/doctor/stats",
    );
  });

  it("marks Appointments current for the week schedule", () => {
    renderRail("/doctor");
    expect(screen.getByRole("link", { name: /Appointments/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks Availability current on the schedule route", () => {
    renderRail("/doctor/schedule");
    expect(screen.getByRole("link", { name: /Availability/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("leaves notifications to the header bell", () => {
    renderRail();
    expect(
      screen.queryByRole("button", { name: /Notifications/ }),
    ).not.toBeInTheDocument();
  });

  it("puts the doctor profile and sign-out in the menu", () => {
    renderRail();
    expect(
      screen.getByRole("link", { name: /Dr\. Synthetic Doctor/ }),
    ).toHaveAttribute("href", "/doctor/profile");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
