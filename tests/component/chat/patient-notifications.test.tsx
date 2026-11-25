import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { PatientNotificationsPanel } from "@/components/chat/patient-notifications";
import type { PatientNotification } from "@/lib/notifications/types";
import {
  markAllPatientNotificationsReadAction,
  markPatientNotificationReadAction,
} from "@/server/notifications/patient-actions";

vi.mock("@/server/notifications/patient-actions", () => ({
  markPatientNotificationReadAction: vi.fn(),
  markAllPatientNotificationsReadAction: vi.fn(),
}));

/** Keeps the action pending, so only the optimistic update can explain the UI. */
const never = () => new Promise<never>(() => {});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

const notification = (overrides: Partial<PatientNotification>): PatientNotification => ({
  id: "11111111-1111-4111-8111-111111111111",
  appointmentId: null,
  type: "confirmed",
  title: "Your appointment is confirmed",
  body: "Mon, Jan 5 · 10:00 AM",
  readAt: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("PatientNotificationsPanel", () => {
  it("shows the unread count on the bell row", () => {
    render(
      <PatientNotificationsPanel
        notifications={[notification({}), notification({ id: "22222222-2222-4222-8222-222222222222" })]}
      />,
    );
    expect(screen.getByRole("button", { name: /notifications, 2 unread/i })).toBeInTheDocument();
  });

  it("lists notifications in the open dialog", async () => {
    const user = userEvent.setup();
    render(
      <PatientNotificationsPanel
        notifications={[
          notification({ title: "Payment verified", body: "Your payment receipt was verified." }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByText("Payment verified")).toBeInTheDocument();
    expect(screen.getByText("Your payment receipt was verified.")).toBeInTheDocument();
  });

  it("says so when there is nothing to show", async () => {
    const user = userEvent.setup();
    render(<PatientNotificationsPanel notifications={[]} />);

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });

  it("offers mark-as-read only for unread notifications", async () => {
    const user = userEvent.setup();
    render(
      <PatientNotificationsPanel
        notifications={[
          notification({ readAt: "2026-11-20T00:00:00.000Z" }),
          notification({ id: "22222222-2222-4222-8222-222222222222", title: "Cancelled" }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(screen.getAllByRole("button", { name: /mark as read/i })).toHaveLength(1);
  });

  it("marks one read at once, before the server answers", async () => {
    vi.mocked(markPatientNotificationReadAction).mockImplementationOnce(never);
    const user = userEvent.setup();
    render(
      <PatientNotificationsPanel
        notifications={[
          notification({}),
          notification({ id: "22222222-2222-4222-8222-222222222222", title: "Cancelled" }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications, 2 unread/i }));
    await user.click(screen.getAllByRole("button", { name: /^mark as read$/i })[0]);

    expect(await screen.findAllByRole("button", { name: /^mark as read$/i })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /notifications, 1 unread/i, hidden: true }),
    ).toBeInTheDocument();
  });

  it("marks all read at once, before the server answers", async () => {
    vi.mocked(markAllPatientNotificationsReadAction).mockImplementationOnce(never);
    const user = userEvent.setup();
    render(
      <PatientNotificationsPanel
        notifications={[
          notification({}),
          notification({ id: "22222222-2222-4222-8222-222222222222", title: "Cancelled" }),
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications, 2 unread/i }));
    await user.click(screen.getByRole("button", { name: /mark all as read/i }));

    await vi.waitFor(() =>
      expect(screen.queryAllByRole("button", { name: /^mark as read$/i })).toHaveLength(0),
    );
    expect(
      screen.getByRole("button", { name: /^notifications$/i, hidden: true }),
    ).toBeInTheDocument();
  });
});
