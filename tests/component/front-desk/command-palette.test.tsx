import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "@/components/front-desk/command-palette";
import { searchAppointmentsQuickAction } from "@/server/front-desk/actions";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/server/front-desk/actions", () => ({ searchAppointmentsQuickAction: vi.fn() }));

const RESULT = {
  id: "ab12cd34-0000-4000-8000-000000000202",
  patientName: "Synthetic Patient A",
  patientPhone: "09171234567",
  doctorName: "Dr. Synthetic Reyes",
  scheduledAt: "2026-11-05T01:30:00.000Z",
  status: "confirmed" as const,
  bookingSource: "front_desk" as const,
};

beforeEach(() => {
  push.mockReset();
  vi.mocked(searchAppointmentsQuickAction).mockReset();
});

async function openWithShortcut() {
  const user = userEvent.setup();
  render(<CommandPalette />);
  await user.keyboard("{Control>}k{/Control}");
  return { user, dialog: await screen.findByRole("dialog", { name: "Quick search" }) };
}

describe("CommandPalette", () => {
  it("opens from its labelled trigger, which advertises the shortcut", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    const trigger = screen.getByRole("button", { name: "Find patient" });
    expect(trigger).toHaveAttribute("aria-keyshortcuts", "Meta+K Control+K");
    await user.click(trigger);

    expect(await screen.findByRole("dialog", { name: "Quick search" })).toBeInTheDocument();
  });

  it("opens with Ctrl+K and moves to a front desk page", async () => {
    const { user, dialog } = await openWithShortcut();

    expect(within(dialog).getByRole("combobox")).toHaveFocus();
    await user.click(within(dialog).getByRole("option", { name: "Daily schedule" }));

    expect(push).toHaveBeenCalledWith("/front-desk/schedule");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("waits for two characters before searching appointments", async () => {
    const { user, dialog } = await openWithShortcut();

    await user.type(within(dialog).getByRole("combobox"), "S");

    expect(
      within(dialog).getByText("Type at least 2 characters to search appointments."),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(searchAppointmentsQuickAction).not.toHaveBeenCalled();
  });

  it("searches appointments and opens the chosen one", async () => {
    vi.mocked(searchAppointmentsQuickAction).mockResolvedValue({
      status: "success",
      items: [RESULT],
    });
    const { user, dialog } = await openWithShortcut();

    await user.type(within(dialog).getByRole("combobox"), "Synthetic");

    const option = await within(dialog).findByRole("option", { name: /Synthetic Patient A/ });
    expect(searchAppointmentsQuickAction).toHaveBeenCalledTimes(1);
    expect(searchAppointmentsQuickAction).toHaveBeenCalledWith("Synthetic");
    expect(option).toHaveTextContent("Dr. Synthetic Reyes");
    expect(option).toHaveTextContent("Confirmed");

    await user.click(option);
    expect(push).toHaveBeenCalledWith(`/front-desk/requests/${RESULT.id}`);
  });

  it("says when no appointment matches", async () => {
    vi.mocked(searchAppointmentsQuickAction).mockResolvedValue({ status: "success", items: [] });
    const { user, dialog } = await openWithShortcut();

    await user.type(within(dialog).getByRole("combobox"), "Nobody");

    expect(await within(dialog).findByText("No appointments match “Nobody”.")).toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    vi.mocked(searchAppointmentsQuickAction).mockResolvedValue({
      status: "error",
      message: "You are not authorized to search appointments.",
    });
    const { user, dialog } = await openWithShortcut();

    await user.type(within(dialog).getByRole("combobox"), "Synthetic");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "You are not authorized to search appointments.",
    );
  });
});
