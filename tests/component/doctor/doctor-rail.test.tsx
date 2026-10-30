import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DoctorRail } from "@/components/doctor/doctor-rail";
import { NotificationsDialogProvider } from "@/components/doctor/notifications-dialog";

vi.mock("@/server/auth/actions", () => ({
  signOutAction: vi.fn(),
}));

// jsdom does not implement modal dialogs; mimic the open contract.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
});

function renderRail(activeView: "week" | "calendar" = "week") {
  return render(
    <NotificationsDialogProvider panel={<p>Synthetic notification feed</p>}>
      <DoctorRail
        activeView={activeView}
        doctorName="Dr. Synthetic Doctor"
        specialty="Cardiology"
        unreadCount={3}
      />
    </NotificationsDialogProvider>,
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
      screen.getByRole("button", { name: /Notifications, 3 unread/ }),
    ).toBeInTheDocument();
  });

  it("opens the notifications modal from the rail", async () => {
    const user = userEvent.setup();
    renderRail();

    await user.click(
      screen.getByRole("button", { name: /Notifications, 3 unread/ }),
    );

    expect(
      screen.getByRole("dialog", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic notification feed")).toBeInTheDocument();
  });

  it("puts the doctor profile and sign-out in the menu", () => {
    renderRail();
    expect(
      screen.getByRole("link", { name: /Dr\. Synthetic Doctor/ }),
    ).toHaveAttribute("href", "/doctor?view=profile");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
