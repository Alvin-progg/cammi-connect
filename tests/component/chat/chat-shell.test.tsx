import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatShell } from "@/components/chat/chat-shell";
import type { PatientAppointment } from "@/lib/appointments/types";
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
    appointments: { upcoming: PatientAppointment[]; past: PatientAppointment[] } | null;
  }> = {},
) {
  return render(
    <ChatShell
      salutation="Good Morning"
      firstName="Ana"
      conversations={CONVERSATIONS}
      conversationId={overrides.conversationId ?? null}
      initialMessages={overrides.initialMessages ?? []}
      appointments={overrides.appointments ?? null}
    />,
  );
}

const UPCOMING: PatientAppointment = {
  id: "appointment-1",
  doctorName: "Dr. Maya Santos",
  departmentName: "Cardiology",
  reason: "Follow-up on blood pressure",
  scheduledAt: "2026-11-02T01:00:00.000Z",
  durationMinutes: 30,
  status: "requested",
};
const PAST: PatientAppointment = {
  id: "appointment-2",
  doctorName: "Dr. Paolo Reyes",
  departmentName: null,
  reason: null,
  scheduledAt: "2026-10-01T06:00:00.000Z",
  durationMinutes: 30,
  status: "completed",
};

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
      ["Hospital Information", "Ask a Question"],
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "My Appointments" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Appointments" })).toHaveAttribute(
      "href",
      "/chat?view=appointments",
    );
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
    // The rail keeps only the action icons; the conversation list is hidden and inert.
    expect(within(sidebar()).getByRole("link", { name: "New conversation" })).toBeInTheDocument();
    const list = within(sidebar()).getByRole("navigation", { name: "Previous conversations" });
    expect(list.closest("[inert]")).not.toBeNull();

    fireEvent.click(expand);
    expect(sidebar()).toHaveAttribute("data-state", "open");
    expect(
      within(sidebar()).getByRole("navigation", { name: "Previous conversations" }).closest("[inert]"),
    ).toBeNull();
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
    const markup = '<img src=x onerror="window.__xss=1"><b>bold</b>';
    const { container } = renderShell({
      conversationId: CONVERSATIONS[0].id,
      initialMessages: [
        { id: "u1", role: "user", content: markup, payload: null, createdAt: "2026-10-30T01:00:00.000Z" },
        { id: "a1", role: "assistant", content: markup, payload: null, createdAt: "2026-10-30T01:00:01.000Z" },
      ],
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getAllByText(markup)).toHaveLength(2);
  });

  it("announces new messages politely and labels assistant replies", () => {
    renderShell({
      conversationId: CONVERSATIONS[0].id,
      initialMessages: [
        { id: "a1", role: "assistant", content: "Hello", payload: null, createdAt: "2026-10-30T01:00:01.000Z" },
      ],
    });

    const thread = screen.getByRole("log", { name: "Conversation" });
    expect(thread).toHaveAttribute("aria-live", "polite");
    expect(within(thread).getByText("CamiConnect")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: /Good Morning/ })).not.toBeInTheDocument();
  });

  it("lists the sources under a grounded answer", () => {
    renderShell({
      conversationId: CONVERSATIONS[0].id,
      initialMessages: [
        {
          id: "a1",
          role: "assistant",
          content: "Please bring a valid government ID.",
          payload: {
            kind: "sources",
            sources: [
              { slug: "required-documents", title: "Required Documents", sectionTitle: "Identification" },
              { slug: "visit-guidelines", title: "Visit Guidelines", sectionTitle: null },
            ],
          },
          createdAt: "2026-10-30T01:00:01.000Z",
        },
      ],
    });

    const sources = screen.getByRole("list", { name: "Sources" });
    expect(within(sources).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Required Documents — Identification",
      "Visit Guidelines",
    ]);
  });

  it("renders source titles inertly", () => {
    const markup = '<img src=x onerror="window.__xss=1">';
    const { container } = renderShell({
      conversationId: CONVERSATIONS[0].id,
      initialMessages: [
        {
          id: "a1",
          role: "assistant",
          content: "Answer",
          payload: { kind: "sources", sources: [{ slug: "x", title: markup, sectionTitle: null }] },
          createdAt: "2026-10-30T01:00:01.000Z",
        },
      ],
    });

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(markup)).toBeInTheDocument();
  });

  it("marks an unverified answer with a callout", () => {
    renderShell({
      conversationId: CONVERSATIONS[0].id,
      initialMessages: [
        {
          id: "a1",
          role: "assistant",
          content: "I couldn't verify that.",
          payload: { kind: "not_verified" },
          createdAt: "2026-10-30T01:00:01.000Z",
        },
      ],
    });

    expect(screen.getByRole("note")).toHaveTextContent(/not found in the hospital's information/i);
    expect(screen.queryByRole("list", { name: "Sources" })).not.toBeInTheDocument();
  });
});

describe("ChatShell booking cards", () => {
  const SPECIALTY_ID = "00000000-0000-4000-8000-0000000005a1";
  const SUMMARY: ChatMessage = {
    id: "m4",
    role: "assistant",
    content: "Please review your appointment request.",
    payload: {
      kind: "booking_summary",
      doctorName: "Dr. Maya Santos",
      specialtyName: "Cardiology",
      start: "2026-11-03T01:00:00.000Z",
      end: "2026-11-03T01:30:00.000Z",
      reason: null,
    },
    createdAt: "2026-10-31T01:00:03.000Z",
  };
  const OLDER_OPTIONS: ChatMessage = {
    id: "m2",
    role: "assistant",
    content: "Which specialty would you like to book?",
    payload: { kind: "specialty_options", specialties: [{ id: SPECIALTY_ID, name: "Cardiology" }] },
    createdAt: "2026-10-31T01:00:01.000Z",
  };

  it("sends a card action for the open conversation and appends the reply", async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        conversationId: CONVERSATIONS[0].id,
        messages: [
          { id: "m5", role: "user", content: "Confirm booking", payload: null, createdAt: "x" },
          {
            id: "m6",
            role: "assistant",
            content: "Your appointment request has been received.",
            payload: null,
            createdAt: "y",
          },
        ],
        state: { step: "booked", draft: {} },
        requestId: "r1",
      }),
    );
    renderShell({ conversationId: CONVERSATIONS[0].id, initialMessages: [OLDER_OPTIONS, SUMMARY] });

    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      conversationId: CONVERSATIONS[0].id,
      event: { type: "confirm_booking" },
    });
    expect(await screen.findByText("Your appointment request has been received.")).toBeInTheDocument();
  });

  it("only lets the latest card act", () => {
    renderShell({ conversationId: CONVERSATIONS[0].id, initialMessages: [OLDER_OPTIONS, SUMMARY] });

    expect(screen.getByRole("button", { name: "Cardiology" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeEnabled();
  });

  it("sends Confirm once even when clicked twice quickly", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderShell({ conversationId: CONVERSATIONS[0].id, initialMessages: [SUMMARY] });

    const confirm = screen.getByRole("button", { name: "Confirm booking" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(await screen.findByRole("button", { name: "Booking…" })).toBeDisabled();
  });

  it("shows a toast without chat content when a card action fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: "The assistant is unavailable right now." } }),
    } as Response);
    renderShell({ conversationId: CONVERSATIONS[0].id, initialMessages: [SUMMARY] });

    fireEvent.click(screen.getByRole("button", { name: "Confirm booking" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Confirm booking" })).toBeEnabled();
  });
});

describe("ChatShell appointments view", () => {
  it("links to it from the sidebar", () => {
    renderShell();

    const link = within(screen.getByRole("complementary", { name: "Chat sidebar" })).getByRole(
      "link",
      { name: "My appointments" },
    );
    expect(link).toHaveAttribute("href", "/chat?view=appointments");
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("shows upcoming and past appointments instead of the chat", () => {
    renderShell({ appointments: { upcoming: [UPCOMING], past: [PAST] } });

    expect(screen.getByRole("heading", { level: 1, name: "My Appointments" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("complementary", { name: "Chat sidebar" })).getByRole("link", {
        name: "My appointments",
      }),
    ).toHaveAttribute("aria-current", "page");

    const upcoming = screen.getByRole("region", { name: "Upcoming" });
    expect(within(upcoming).getByText("Dr. Maya Santos")).toBeInTheDocument();
    expect(within(upcoming).getByText(/Cardiology/)).toBeInTheDocument();
    expect(within(upcoming).getByText("Requested")).toBeInTheDocument();
    expect(within(upcoming).getByText("Follow-up on blood pressure")).toBeInTheDocument();

    const past = screen.getByRole("region", { name: "Past" });
    expect(within(past).getByText("Dr. Paolo Reyes")).toBeInTheDocument();
    expect(within(past).getByText("Completed")).toBeInTheDocument();

    expect(screen.getByText(/not confirmed until the doctor confirms/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Good Morning/ })).not.toBeInTheDocument();
  });

  it("shows an empty state that leads back to the chat", () => {
    renderShell({ appointments: { upcoming: [], past: [] } });

    expect(screen.getByText("No appointments yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to chat" })).toHaveAttribute("href", "/chat");
  });

  it("renders appointment text inertly", () => {
    const { container } = renderShell({
      appointments: {
        upcoming: [{ ...UPCOMING, reason: '<img src=x onerror="alert(1)">' }],
        past: [],
      },
    });

    expect(container.querySelector("img")).toBeNull();
  });
});
