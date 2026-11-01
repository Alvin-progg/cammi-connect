"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import type { PatientAppointmentGroups } from "@/lib/appointments/patient";
import type {
  BookingEvent,
  ChatEvent,
  ChatMessage,
  ConversationSummary,
} from "@/lib/chat/schemas";

import { AppointmentsPanel } from "./appointments-panel";

import { ChatComposer } from "./chat-composer";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatSidebar, type SidebarState } from "./chat-sidebar";
import { AssistantStatus, MessageBubble } from "./message-bubble";

type ChatResponse = { conversationId: string; messages: ChatMessage[] };

const FALLBACK_ERROR = "The assistant is unavailable right now. Please try again in a moment.";

// Matches Tailwind's `md` breakpoint, where the sidebar stops overlaying the chat.
const DESKTOP_QUERY = "(min-width: 48rem)";

function subscribeToDesktop(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isDesktopViewport(): boolean {
  return typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_QUERY).matches : true;
}

/** Unknown while server rendering; the sidebar then falls back to CSS breakpoints. */
function useIsDesktop(): boolean | null {
  return useSyncExternalStore(subscribeToDesktop, isDesktopViewport, () => null);
}

/** Reads the server's fixed error copy; it never contains chat text. */
async function errorMessageFrom(response: Response): Promise<string> {
  try {
    const body: { error?: { message?: unknown } } = await response.json();
    return typeof body.error?.message === "string" ? body.error.message : FALLBACK_ERROR;
  } catch {
    return FALLBACK_ERROR;
  }
}

export function ChatShell({
  salutation,
  firstName,
  conversations,
  conversationId,
  initialMessages,
  appointments,
}: {
  salutation: string;
  firstName: string;
  conversations: ConversationSummary[];
  conversationId: string | null;
  initialMessages: ChatMessage[];
  /** Set when `/chat?view=appointments` is open; the chat thread is hidden then. */
  appointments: PatientAppointmentGroups | null;
}) {
  const router = useRouter();
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const [messages, setMessages] = useState(initialMessages);
  // null while idle; text is the patient's message, or null for a card action.
  const [pending, setPending] = useState<{ text: string | null; startedAt: number } | null>(
    null,
  );
  // Reply times for assistant messages that arrived in this session; only these type out.
  const [replyTimes, setReplyTimes] = useState<Record<string, number>>({});
  // Blocks a second request before React re-renders, e.g. a double-clicked Confirm.
  const sendingRef = useRef(false);
  const [draft, setDraft] = useState("");
  const isDesktop = useIsDesktop();
  // null follows the viewport: open on desktop, a collapsed rail on mobile.
  const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const threadEndRef = useRef<HTMLLIElement>(null);

  const sidebarExpanded = sidebarChoice ?? isDesktop;
  const sidebarState: SidebarState =
    sidebarExpanded === null ? "auto" : sidebarExpanded ? "open" : "closed";
  const isSending = pending !== null;
  const latestAssistantId = messages.findLast((message) => message.role === "assistant")?.id;

  function openHistory() {
    setSidebarChoice(true);
    setSearchOpen(true);
  }
  const hasThread = messages.length > 0 || isSending;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, pending]);

  const sidebarOverlays = sidebarState === "open" && isDesktop === false;
  useEffect(() => {
    if (!sidebarOverlays) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSidebarChoice(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOverlays]);

  /** Posts one chat event; resolves false after showing a toast when it fails. */
  async function postEvent(event: ChatEvent, pendingText: string | null): Promise<boolean> {
    if (sendingRef.current) return false;
    sendingRef.current = true;
    const startedAt = Date.now();
    setPending({ text: pendingText, startedAt });

    try {
      const response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
          event,
        }),
      });
      if (!response.ok) {
        throw new Error(await errorMessageFrom(response));
      }

      const body: ChatResponse = await response.json();
      const elapsedMs = Date.now() - startedAt;
      setReplyTimes((current) => {
        const next = { ...current };
        for (const message of body.messages) {
          if (message.role === "assistant") next[message.id] = elapsedMs;
        }
        return next;
      });
      setMessages((current) => [...current, ...body.messages]);
      if (!activeConversationId) {
        setActiveConversationId(body.conversationId);
        router.replace(`/chat?c=${body.conversationId}`, { scroll: false });
      }
      return true;
    } catch (error) {
      // The toast never echoes chat content.
      const description =
        error instanceof Error && !(error instanceof TypeError) ? error.message : FALLBACK_ERROR;
      toast.error("Message not sent", { id: "chat-send-error", description });
      return false;
    } finally {
      sendingRef.current = false;
      setPending(null);
    }
  }

  async function send(text: string, { fromDraft }: { fromDraft: boolean }) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    if (fromDraft) setDraft("");
    const sent = await postEvent({ type: "message", text: trimmed }, trimmed);
    // Keep the patient's text for a retry.
    if (!sent && fromDraft) setDraft(text);
  }

  function sendBookingEvent(event: BookingEvent) {
    void postEvent(event, null);
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* Reserves the rail's width on mobile, where the open sidebar overlays the chat. */}
      <div className="w-16 shrink-0 md:w-auto">
        {sidebarOverlays ? (
          <div
            aria-hidden="true"
            onClick={() => setSidebarChoice(false)}
            className="fixed inset-0 z-30 bg-overlay md:hidden"
          />
        ) : null}
        <ChatSidebar
          state={sidebarState}
          onToggle={() => setSidebarChoice(!(sidebarExpanded ?? true))}
          onExpand={() => setSidebarChoice(true)}
          onNavigate={() => {
            if (isDesktop === false) setSidebarChoice(false);
          }}
          searchOpen={searchOpen}
          onSearchOpenChange={setSearchOpen}
          conversations={conversations}
          activeConversationId={appointments ? null : activeConversationId}
          appointmentsActive={appointments !== null}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {appointments ? (
          <AppointmentsPanel upcoming={appointments.upcoming} past={appointments.past} />
        ) : (
          <>
            {hasThread ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <h1 className="sr-only">Chat with CamiConnect</h1>
                <ol
                  role="log"
                  aria-label="Conversation"
                  aria-live="polite"
                  className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6"
                >
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      payload={message.payload}
                      interactive={message.id === latestAssistantId}
                      busy={isSending}
                      onEvent={sendBookingEvent}
                      reveal={
                        message.id in replyTimes ? { elapsedMs: replyTimes[message.id] } : null
                      }
                    />
                  ))}
                  {pending !== null ? (
                    <>
                      {pending.text !== null ? (
                        <MessageBubble role="user" content={pending.text} />
                      ) : null}
                      <AssistantStatus startedAt={pending.startedAt} />
                    </>
                  ) : null}
                  <li ref={threadEndRef} aria-hidden="true" />
                </ol>
              </div>
            ) : (
              <ChatEmptyState
                salutation={salutation}
                firstName={firstName}
                disabled={isSending}
                onSuggestion={(message) => send(message, { fromDraft: false })}
              />
            )}

            <ChatComposer
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={() => send(draft, { fromDraft: true })}
              onOpenHistory={openHistory}
              isSending={isSending}
            />
          </>
        )}
      </div>
    </div>
  );
}
