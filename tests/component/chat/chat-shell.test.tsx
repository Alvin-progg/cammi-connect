import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatShell } from "@/components/chat/chat-shell";
import type { ChatMessage, ConversationSummary } from "@/lib/chat/schemas";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push, refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: vi.fn(), dismiss: vi.fn() },
}));

const CONVERSATIONS: ConversationSummary[] = [
  {
    id: "00000000-0000-4000-8000-00000000c001",
    title: "Cardiology questions",
    updatedAt: "2026-10-29T01:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-00000000c002",
    title: "Visiting hours",
    updatedAt: "2026-10-28T01:00:00.000Z",
  },
];

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  // jsdom does not implement modal dialogs.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderShell(
  overrides: Partial<{
    conversationId: string | null;
    initialMessages: ChatMessage[];
  }> = {},
) {
  return render(
    <ChatShell
      salutation="Good Morning"
      firstName="Ana"
      conversations={CONVERSATIONS}
      conversationId={overrides.conversationId ?? null}
      initialMessages={overrides.initialMessages ?? []}
    />,
  );
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe("ChatShell empty state", () => {
  it("greets the patient by first name", () => {
    renderShell();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Good Morning, Ana");
    expect(within(heading).getByText("Ana")).toHaveClass("text-ink-muted");
  });

  it("shows the three suggestion cards with their actions", () => {
    renderShell();

    for (const [title, action] of [
      ["Book an Appointment", "Start Booking"],
      ["My Appointments", "View Appointments"],
      ["Hospital Information", "Ask a Question"],
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
    }
  });

  it("sends a canned message when a suggestion is chosen", async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        conversationId: CONVERSATIONS[0].id,
        messages: [],
        state: null,
        requestId: "r1",
      }),
    );
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Start Booking" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/chat");
    expect(JSON.parse(init.body)).toEqual({
      event: { type: "message", text: "I'd like to book an appointment." },
    });
  });

  it("shows the persistent notice and privacy line", () => {
    renderShell();

    const notice = screen.getByText(/AI-generated/);
    expect(notice).toHaveTextContent("not medical advice");
    expect(notice).toHaveTextContent("not an appointment confirmation");
    expect(notice).toHaveTextContent(/stored and sent to Google Gemini and OpenCode Zen/);
  });
});

describe("ChatShell top bar and history", () => {
  it("has New Chat and labelled icon buttons, and no Share button", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "New Chat" })).toHaveAttribute("href", "/chat");
    expect(screen.getByRole("button", { name: "Search chats" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show chat history" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
  });

  it.each(["Search chats", "Show chat history", "Open chat history"])(
    "opens the history drawer from %s",
    (label) => {
      renderShell();

      fireEvent.click(screen.getByRole("button", { name: label }));

      const drawer = screen.getByRole("dialog", { name: "Chat history" });
      expect(within(drawer).getByRole("link", { name: /Cardiology questions/ })).toHaveAttribute(
        "href",
        `/chat?c=${CONVERSATIONS[0].id}`,
      );
    },
  );

  it("filters past chats by title", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Search chats" }));
    const drawer = screen.getByRole("dialog", { name: "Chat history" });

    fireEvent.change(within(drawer).getByRole("searchbox", { name: "Search chats" }), {
      target: { value: "visit" },
    });

    expect(within(drawer).queryByText("Cardiology questions")).not.toBeInTheDocument();
    expect(within(drawer).getByText("Visiting hours")).toBeInTheDocument();
  });
});

describe("ChatShell composer", () => {
  it("counts characters against the 1000 limit", () => {
    renderShell();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });

    expect(screen.getByText("5/1000")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveAttribute("maxLength", "1000");
  });

  it("disables send while the draft is empty", () => {
    renderShell();

    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("shows the reply and moves a new chat to its URL", async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        conversationId: CONVERSATIONS[0].id,
        messages: [
          { id: "u1", role: "user", content: "Hello", createdAt: "2026-10-30T01:00:00.000Z" },
          { id: "a1", role: "assistant", content: "Hi there", createdAt: "2026-10-30T01:00:01.000Z" },
        ],
        state: null,
        requestId: "r1",
      }),
    );
    renderShell();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Hi there")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(mocks.replace).toHaveBeenCalledWith(`/chat?c=${CONVERSATIONS[0].id}`, {
      scroll: false,
    });
  });

  it("keeps the draft and shows a toast without chat content when sending fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: { code: "unavailable", message: "The assistant is unavailable. Please try again." },
      }),
    } as Response);
    renderShell();

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "my private question" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Message")).toHaveValue("my private question");
    expect(JSON.stringify(mocks.toastError.mock.calls)).not.toContain("my private question");
    expect(screen.queryByText("my private question", { selector: "p" })).not.toBeInTheDocument();
  });

  it("keeps the draft when the network fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderShell();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Message")).toHaveValue("Hello");
  });
});

describe("ChatShell thread", () => {
  it("renders message text inertly", () => {
    const payload = '<img src=x onerror="window.__xss=1"><b>bold</b>';
    const { container } = renderShell({
      conversationId: CONVERSATIONS[0].id,
      initialMessages: [
        { id: "u1", role: "user", content: payload, createdAt: "2026-10-30T01:00:00.000Z" },
        { id: "a1", role: "assistant", content: payload, createdAt: "2026-10-30T01:00:01.000Z" },
      ],
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getAllByText(payload)).toHaveLength(2);
  });

  it("announces new messages politely and labels assistant replies", () => {
    renderShell({
      conversationId: CONVERSATIONS[0].id,
      initialMessages: [
        { id: "a1", role: "assistant", content: "Hello", createdAt: "2026-10-30T01:00:01.000Z" },
      ],
    });

    const thread = screen.getByRole("log", { name: "Conversation" });
    expect(thread).toHaveAttribute("aria-live", "polite");
    expect(within(thread).getByText("CamiConnect")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /Good Morning/ })).not.toBeInTheDocument();
  });
});
