import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  AppointmentReminder,
  DoctorNotification,
} from "@/lib/notifications/types";

type ActionResult = { status: "success" | "error"; message: string };

const { markNotificationReadAction, markAllNotificationsReadAction } = vi.hoisted(() => ({
  markNotificationReadAction: vi.fn<
    (state: unknown, formData: FormData) => Promise<ActionResult>
  >(async () => ({ status: "success", message: "Notification marked as read." })),
  markAllNotificationsReadAction: vi.fn<
    (state: unknown, formData: FormData) => Promise<ActionResult>
  >(),
}));

vi.mock("@/server/notifications/actions", () => ({
  markNotificationReadAction,
  markAllNotificationsReadAction,
}));

/** An action call the test settles by hand, to observe the pending UI. */
function deferredResult() {
  let settle: (result: ActionResult) => void = () => {};
  const promise = new Promise<ActionResult>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

const { NotificationsPanel } = await import(
  "@/components/doctor/notifications-panel"
);

const NEW_REQUEST: DoctorNotification = {
  id: "n-1",
  appointmentId: "a-1",
  type: "new_request",
  title: "New request: Synthetic Patient A",
  body: "Waiting for front desk confirmation",
  readAt: null,
  createdAt: "2026-11-08T01:00:00.000Z",
};
const RESCHEDULED: DoctorNotification = {
  id: "n-2",
  appointmentId: "a-2",
  type: "rescheduled",
  title: "Rescheduled by front desk",
  body: "Synthetic Patient B moved",
  readAt: "2026-11-08T02:00:00.000Z",
  createdAt: "2026-11-07T01:00:00.000Z",
};
const REMINDER: AppointmentReminder = {
  appointmentId: "a-3",
  patientName: "Synthetic Patient C",
  scheduledAt: "2026-11-09T01:00:00.000Z",
};

describe("NotificationsPanel", () => {
  it("shows only unread items on the Unread tab, with its count", () => {
    render(
      <NotificationsPanel
        notifications={[NEW_REQUEST, RESCHEDULED]}
        reminders={[]}
      />,
    );

    const unreadTab = screen.getByRole("tab", { name: /Unread/ });
    expect(unreadTab).toHaveAttribute("aria-selected", "true");
    expect(within(unreadTab).getByText("1")).toBeInTheDocument();
    expect(screen.getByText(NEW_REQUEST.title)).toBeInTheDocument();
    expect(screen.queryByText(RESCHEDULED.title)).toBeNull();
  });

  it("shows every item and reminders on the All tab", async () => {
    const user = userEvent.setup();
    render(
      <NotificationsPanel
        notifications={[NEW_REQUEST, RESCHEDULED]}
        reminders={[REMINDER]}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "All" }));

    expect(screen.getByText(NEW_REQUEST.title)).toBeInTheDocument();
    expect(screen.getByText(RESCHEDULED.title)).toBeInTheDocument();
    expect(
      screen.getByText("Upcoming: Synthetic Patient C"),
    ).toBeInTheDocument();
  });

  it("has no week-view link, matching the reference", () => {
    render(<NotificationsPanel notifications={[NEW_REQUEST]} reminders={[]} />);

    expect(screen.queryByRole("link", { name: "View in week" })).toBeNull();
  });

  it("keeps Mark all as read visible but disabled when nothing is unread", () => {
    render(<NotificationsPanel notifications={[RESCHEDULED]} reminders={[]} />);

    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeDisabled();
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(RESCHEDULED.title)).toBeInTheDocument();
  });

  it("opens an unread notification's details and marks it read", async () => {
    markNotificationReadAction.mockClear();
    const user = userEvent.setup();
    render(<NotificationsPanel notifications={[NEW_REQUEST]} reminders={[]} />);

    await user.click(screen.getByRole("button", { name: /New request: Synthetic Patient A/ }));

    expect(
      screen.getByRole("heading", { name: NEW_REQUEST.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(NEW_REQUEST.body)).toBeInTheDocument();
    expect(screen.getByText("New request")).toBeInTheDocument();
    expect(markNotificationReadAction).toHaveBeenCalledTimes(1);
    expect(markNotificationReadAction.mock.calls[0]?.[1].get("notificationId")).toBe(
      NEW_REQUEST.id,
    );

    await user.click(screen.getByRole("button", { name: "Back to notifications" }));
    expect(screen.getByRole("tab", { name: /Unread/ })).toBeInTheDocument();
  });

  it("opens a read notification's details without marking it again", async () => {
    markNotificationReadAction.mockClear();
    const user = userEvent.setup();
    render(<NotificationsPanel notifications={[RESCHEDULED]} reminders={[]} />);

    await user.click(screen.getByRole("button", { name: /Rescheduled by front desk/ }));

    expect(
      screen.getByRole("heading", { name: RESCHEDULED.title }),
    ).toBeInTheDocument();
    expect(markNotificationReadAction).not.toHaveBeenCalled();
  });

  it("shows relative times and no per-item mark-read button", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T19:00:00.000Z"));
    try {
      render(<NotificationsPanel notifications={[NEW_REQUEST]} reminders={[]} />);
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByText("18 h ago")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark read" })).toBeNull();
  });

  it("shows Mark all as read when something is unread", () => {
    render(<NotificationsPanel notifications={[NEW_REQUEST]} reminders={[]} />);

    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state per tab", async () => {
    const user = userEvent.setup();
    render(<NotificationsPanel notifications={[]} reminders={[]} />);

    expect(screen.getByText(/No notifications yet/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Unread/ }));
    expect(screen.getByText("No unread notifications.")).toBeInTheDocument();
  });

  it("clears unread items at once on Mark all as read and restores them if it fails", async () => {
    const pending = deferredResult();
    markAllNotificationsReadAction.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    render(<NotificationsPanel notifications={[NEW_REQUEST]} reminders={[]} />);

    await user.click(screen.getByRole("button", { name: "Mark all as read" }));

    expect(screen.getByText("No unread notifications.")).toBeInTheDocument();

    await act(async () => pending.settle({ status: "error", message: "Unable to update." }));

    expect(
      screen.getByRole("button", { name: /New request: Synthetic Patient A/ }),
    ).toBeInTheDocument();
  });

  it("shows an opened notification as read before the save finishes", async () => {
    const pending = deferredResult();
    markNotificationReadAction.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    render(<NotificationsPanel notifications={[NEW_REQUEST]} reminders={[]} />);

    await user.click(screen.getByRole("button", { name: /New request: Synthetic Patient A/ }));
    await user.click(screen.getByRole("button", { name: "Back to notifications" }));

    expect(screen.getByText("No unread notifications.")).toBeInTheDocument();

    await act(async () => pending.settle({ status: "error", message: "Unable to update." }));

    expect(
      screen.getByRole("button", { name: /New request: Synthetic Patient A/ }),
    ).toBeInTheDocument();
  });
});
