import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DoctorRail } from "@/components/doctor/doctor-rail";

vi.mock("@/server/auth/actions", () => ({
  signOutAction: vi.fn(),
}));

function renderRail(activeView: "week" | "calendar" = "week") {
  return render(
    <DoctorRail
      activeView={activeView}
      doctorName="Dr. Synthetic Doctor"
      specialty="Cardiology"
      unreadCount={3}
    />,
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

  it("marks Appointments current for the week schedule", () => {
    renderRail("week");
    expect(screen.getByRole("link", { name: /Appointments/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("links availability and announces unread notifications", () => {
    renderRail("calendar");
    expect(screen.getByRole("link", { name: /Availability/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /Notifications, 3 unread/ }),
    ).toBeInTheDocument();
  });

  it("puts the doctor profile and sign-out in the menu", () => {
    renderRail();
    expect(
      screen.getByRole("link", { name: /Dr\. Synthetic Doctor/ }),
    ).toHaveAttribute("href", "/doctor?view=profile");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
