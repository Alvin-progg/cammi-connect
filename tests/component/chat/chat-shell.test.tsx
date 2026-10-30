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

describe("ChatShell sidebar", () => {
  function sidebar() {
    return screen.getByRole("complementary", { name: "Chat sidebar" });
  }

  it("puts the collapse toggle in the sidebar and has no Share button", () => {
    renderShell();

    const toggle = within(sidebar()).getByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(sidebar()).getByRole("link", { name: "New conversation" })).toHaveAttribute(
      "href",
      "/chat",
    );
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
  });

  it("collapses to an icon rail and expands again", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(sidebar()).toHaveAttribute("data-state", "closed");
    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    // Icon-only links keep their accessible names.
    expect(within(sidebar()).getByRole("link", { name: "Cardiology questions" })).toBeInTheDocument();

    fireEvent.click(expand);
    expect(sidebar()).toHaveAttribute("data-state", "open");
  });

  it("lists previous conversations and marks the open one", () => {
    renderShell({ conversationId: CONVERSATIONS[1].id });

    const list = within(sidebar()).getByRole("navigation", { name: "Previous conversations" });
    expect(within(list).getByRole("link", { name: "Cardiology questions" })).toHaveAttribute(
      "href",
      `/chat?c=${CONVERSATIONS[0].id}`,
    );
    expect(within(list).getByRole("link", { name: "Visiting hours" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("filters previous conversations by title", () => {
    renderShell();

    fireEvent.click(within(sidebar()).getByRole("button", { name: "Search chats" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search conversations" }), {
      target: { value: "visit" },
    });

    expect(within(sidebar()).queryByText("Cardiology questions")).not.toBeInTheDocument();
    expect(within(sidebar()).getByText("Visiting hours")).toBeInTheDocument();
  });

  it("expands a collapsed sidebar into search from the rail", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    fireEvent.click(within(sidebar()).getByRole("button", { name: "Search chats" }));

    expect(sidebar()).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("searchbox", { name: "Search conversations" })).toHaveFocus();
  });

  it("opens history search from the composer", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    fireEvent.click(screen.getByRole("button", { name: "Open chat history" }));

    expect(sidebar()).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("searchbox", { name: "Search conversations" })).toBeInTheDocument();
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
