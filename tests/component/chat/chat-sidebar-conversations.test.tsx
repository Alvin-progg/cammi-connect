import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSidebar } from "@/components/chat/chat-sidebar";
import type { ConversationSummary } from "@/lib/chat/schemas";

const deleteConversationAction = vi.fn(async () => ({ status: "success", message: "Deleted." }));
const setConversationPinnedAction = vi.fn(async () => ({ status: "success", message: "Pinned." }));
const routerPush = vi.fn();

vi.mock("@/server/chat/conversation-actions", () => ({
  deleteConversationAction: (...args: unknown[]) => deleteConversationAction(...(args as [])),
  setConversationPinnedAction: (...args: unknown[]) => setConversationPinnedAction(...(args as [])),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

vi.mock("@/server/notifications/patient-actions", () => ({
  markPatientNotificationReadAction: vi.fn(),
  markAllPatientNotificationsReadAction: vi.fn(),
}));

vi.mock("@/server/auth/actions", () => ({ signOutAction: vi.fn() }));

const RECENT: ConversationSummary = {
  id: "00000000-0000-4000-8000-00000000c001",
  title: "Recent chat",
  updatedAt: "2026-11-20T01:00:00.000Z",
  pinned: false,
};
const PINNED: ConversationSummary = {
  id: "00000000-0000-4000-8000-00000000c002",
  title: "Pinned chat",
  updatedAt: "2026-10-01T01:00:00.000Z",
  pinned: true,
};

function renderSidebar(conversations: ConversationSummary[], activeConversationId: string | null) {
  return render(
    <ChatSidebar
      state="open"
      onToggle={vi.fn()}
      onExpand={vi.fn()}
      onNavigate={vi.fn()}
      searchOpen={false}
      onSearchOpenChange={vi.fn()}
      conversations={conversations}
      activeConversationId={activeConversationId}
      appointmentsActive={false}
      patientName="Maria Santos"
    />,
  );
}

beforeEach(() => {
  deleteConversationAction.mockClear();
  setConversationPinnedAction.mockClear();
  routerPush.mockClear();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

describe("ChatSidebar previous conversations", () => {
  it("keeps the server's order and labels pinned conversations", () => {
    // The repository sorts pinned first; the sidebar renders that order as given.
    renderSidebar([PINNED, RECENT], null);

    const list = screen.getByRole("navigation", { name: "Previous conversations" });
    const titles = within(list)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(titles[0]).toContain("Pinned chat");
    // Rows, not text: each closed delete dialog also repeats its conversation title.
    const [pinnedRow, recentRow] = within(list).getAllByRole("listitem");
    expect(pinnedRow).toHaveTextContent("Pinned");
    expect(recentRow).not.toHaveTextContent("Pinned");
  });

  it("offers Pin for unpinned and Unpin for pinned conversations", () => {
    renderSidebar([RECENT, PINNED], null);

    expect(screen.getByRole("button", { name: "Pin conversation Recent chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpin conversation Pinned chat" })).toBeInTheDocument();
  });

  it("asks before deleting and only then calls the delete action", async () => {
    renderSidebar([RECENT], null);

    fireEvent.click(screen.getByRole("button", { name: "Delete conversation Recent chat" }));
    expect(screen.getByRole("heading", { name: "Delete this conversation?" })).toBeInTheDocument();
    expect(deleteConversationAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));
    await waitFor(() => expect(deleteConversationAction).toHaveBeenCalledTimes(1));
  });

  it("sends the pin state through the pin action", async () => {
    renderSidebar([RECENT], null);

    fireEvent.click(screen.getByRole("button", { name: "Pin conversation Recent chat" }));
    await waitFor(() => expect(setConversationPinnedAction).toHaveBeenCalledTimes(1));
    const formData = (setConversationPinnedAction.mock.calls[0] as unknown[])[1] as FormData;
    expect(formData.get("conversationId")).toBe(RECENT.id);
    expect(formData.get("pinned")).toBe("true");
  });
});

/** An action that stays pending until the test settles it. */
function deferAction() {
  let settle: (state: { status: string; message: string }) => void = () => {};
  const promise = new Promise<{ status: string; message: string }>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

function rowTitles() {
  const list = screen.getByRole("navigation", { name: "Previous conversations" });
  return within(list)
    .queryAllByRole("link")
    .map((link) => link.getAttribute("title"));
}

describe("ChatSidebar optimistic pin and delete", () => {
  it("pins at once and moves the row to the top before the server answers", async () => {
    const pending = deferAction();
    setConversationPinnedAction.mockImplementationOnce(() => pending.promise);
    renderSidebar([PINNED, RECENT], null);

    fireEvent.click(screen.getByRole("button", { name: "Pin conversation Recent chat" }));

    expect(
      await screen.findByRole("button", { name: "Unpin conversation Recent chat" }),
    ).toBeInTheDocument();
    expect(rowTitles()).toEqual(["Recent chat", "Pinned chat"]);
    pending.settle({ status: "success", message: "Pinned." });
  });

  it("unpins at once and returns the row to the unpinned list by recency", async () => {
    const pending = deferAction();
    setConversationPinnedAction.mockImplementationOnce(() => pending.promise);
    renderSidebar([PINNED, RECENT], null);

    fireEvent.click(screen.getByRole("button", { name: "Unpin conversation Pinned chat" }));

    expect(
      await screen.findByRole("button", { name: "Pin conversation Pinned chat" }),
    ).toBeInTheDocument();
    // Pinned chat is older than Recent chat, so it drops below it.
    expect(rowTitles()).toEqual(["Recent chat", "Pinned chat"]);
    pending.settle({ status: "success", message: "Unpinned." });
  });

  it("removes the row at once after confirming delete", async () => {
    const pending = deferAction();
    deleteConversationAction.mockImplementationOnce(() => pending.promise);
    renderSidebar([PINNED, RECENT], null);

    fireEvent.click(screen.getByRole("button", { name: "Delete conversation Recent chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));

    await waitFor(() => expect(rowTitles()).toEqual(["Pinned chat"]));
    pending.settle({ status: "success", message: "Deleted." });
  });

  it("brings the row back when the delete fails", async () => {
    deleteConversationAction.mockImplementationOnce(async () => ({
      status: "error",
      message: "That conversation no longer exists.",
    }));
    renderSidebar([PINNED, RECENT], null);

    fireEvent.click(screen.getByRole("button", { name: "Delete conversation Recent chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));

    await waitFor(() => expect(deleteConversationAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(rowTitles()).toEqual(["Pinned chat", "Recent chat"]));
  });

  it("leaves the open conversation at once when it is deleted", async () => {
    const pending = deferAction();
    deleteConversationAction.mockImplementationOnce(() => pending.promise);
    renderSidebar([RECENT], RECENT.id);

    fireEvent.click(screen.getByRole("button", { name: "Delete conversation Recent chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/chat"));
    pending.settle({ status: "success", message: "Deleted." });
  });
});
