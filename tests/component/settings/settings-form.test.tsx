import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PolicyToKnowledgeBase, SettingsForm } from "@/components/settings/settings-form";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { saveSettingsAction } from "@/server/settings/actions";

vi.mock("@/server/settings/actions", () => ({
  saveSettingsAction: vi.fn(async () => ({ status: "success", message: "Settings saved." })),
  sendPolicyToKnowledgeBaseAction: vi.fn(async () => ({ status: "idle" })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SettingsForm", () => {
  it("shows the appointment fields with their current values", () => {
    render(<SettingsForm group="appointment" settings={DEFAULT_SETTINGS} />);

    expect(screen.getByLabelText("Default slot length")).toHaveValue("30");
    expect(screen.getByLabelText("Minimum booking lead time (hours)")).toHaveValue(2);
    expect(screen.getByLabelText("Maximum advance booking (days)")).toHaveValue(60);
    expect(screen.getByLabelText("Request expiry (hours)")).toHaveValue(null);
  });

  it("shows the timezone as read-only on the hospital tab", () => {
    render(<SettingsForm group="hospital" settings={DEFAULT_SETTINGS} />);

    expect(screen.getByText("Asia/Manila")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /timezone/i })).not.toBeInTheDocument();
    const sunday = screen.getByRole("group", { name: "Sunday" });
    expect(within(sunday).getByLabelText("Closed")).toBeChecked();
  });

  it("never offers model, prompt, or key settings", () => {
    render(<SettingsForm group="chatbot" settings={DEFAULT_SETTINGS} />);

    expect(screen.queryByText(/model|temperature|prompt|api key/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Services")).toBeChecked();
  });

  it("previews the changes and saves only after the admin confirms", async () => {
    render(<SettingsForm group="appointment" settings={DEFAULT_SETTINGS} />);

    fireEvent.change(screen.getByLabelText("Minimum booking lead time (hours)"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));

    const dialog = await screen.findByRole("dialog", { name: "Review changes" });
    expect(within(dialog).getByText("Minimum booking lead time")).toBeInTheDocument();
    expect(within(dialog).getByText("2 hours")).toBeInTheDocument();
    expect(within(dialog).getByText("4 hours")).toBeInTheDocument();
    expect(saveSettingsAction).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(saveSettingsAction).toHaveBeenCalledTimes(1));
    const formData = vi.mocked(saveSettingsAction).mock.calls[0][1];
    expect(formData.get("group")).toBe("appointment");
    expect(formData.get("appointment.min_lead_hours")).toBe("4");
  });

  it("says when nothing changed instead of opening the preview", () => {
    render(<SettingsForm group="chatbot" settings={DEFAULT_SETTINGS} />);

    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Nothing changed.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a validation message instead of the preview", () => {
    render(<SettingsForm group="chatbot" settings={DEFAULT_SETTINGS} />);

    fireEvent.change(screen.getByLabelText("Welcome message"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a welcome message.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("PolicyToKnowledgeBase", () => {
  it("offers to send only a saved policy", () => {
    render(
      <PolicyToKnowledgeBase
        settings={{
          ...DEFAULT_SETTINGS,
          "appointment.cancellation_policy_text": "Cancel a day ahead.",
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Send cancellation policy to knowledge base" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Send reschedule policy to knowledge base" }),
    ).toBeDisabled();
  });
});
