import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";

import {
  NotificationsBellButton,
  NotificationsDialogProvider,
} from "@/components/doctor/notifications-dialog";

// jsdom does not implement modal dialogs; mimic the open/close contract.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

function renderWithBell(unreadCount = 2) {
  return render(
    <NotificationsDialogProvider panel={<p>Synthetic notification feed</p>}>
      <NotificationsBellButton unreadCount={unreadCount} />
    </NotificationsDialogProvider>,
  );
}

describe("NotificationsDialog", () => {
  it("opens the notifications modal from the bell instead of navigating", async () => {
    const user = userEvent.setup();
    renderWithBell();

    expect(screen.queryByText("Synthetic notification feed")).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Notifications, 2 unread" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Synthetic notification feed")).toBeInTheDocument();
  });

  it("closes from the close button", async () => {
    const user = userEvent.setup();
    renderWithBell(0);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByRole("button", { name: "Close notifications" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Synthetic notification feed")).toBeNull();
  });
});
