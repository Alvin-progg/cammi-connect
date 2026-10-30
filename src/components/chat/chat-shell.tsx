"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import type { ChatMessage, ConversationSummary } from "@/lib/chat/schemas";

import { ChatComposer } from "./chat-composer";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatSidebar, type SidebarState } from "./chat-sidebar";
import { MessageBubble, TypingIndicator } from "./message-bubble";

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
}: {
  salutation: string;
  firstName: string;
  conversations: ConversationSummary[];
  conversationId: string | null;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const isDesktop = useIsDesktop();
  // null follows the viewport: open on desktop, a collapsed rail on mobile.
  const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const threadEndRef = useRef<HTMLLIElement>(null);

  const sidebarExpanded = sidebarChoice ?? isDesktop;
  const sidebarState: SidebarState =
    sidebarExpanded === null ? "auto" : sidebarExpanded ? "open" : "closed";
  const isSending = pendingText !== null;

  function openHistory() {
    setSidebarChoice(true);
    setSearchOpen(true);
  }
  const hasThread = messages.length > 0 || isSending;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, pendingText]);

  const sidebarOverlays = sidebarState === "open" && isDesktop === false;
  useEffect(() => {
    if (!sidebarOverlays) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSidebarChoice(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOverlays]);

  async function send(text: string, { fromDraft }: { fromDraft: boolean }) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setPendingText(trimmed);
    if (fromDraft) setDraft("");

    try {
      const response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(activeConversationId ? { conversationId: activeConversationId } : {}),
          event: { type: "message", text: trimmed },
        }),
      });
      if (!response.ok) {
        throw new Error(await errorMessageFrom(response));
      }

      const body: ChatResponse = await response.json();
      setMessages((current) => [...current, ...body.messages]);
      if (!activeConversationId) {
        setActiveConversationId(body.conversationId);
        router.replace(`/chat?c=${body.conversationId}`, { scroll: false });
      }
    } catch (error) {
      // Keep the patient's text for a retry; the toast never echoes it.
      if (fromDraft) setDraft(text);
      const description =
        error instanceof Error && !(error instanceof TypeError) ? error.message : FALLBACK_ERROR;
      toast.error("Message not sent", { id: "chat-send-error", description });
    } finally {
      setPendingText(null);
    }
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
          activeConversationId={activeConversationId}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                <MessageBubble key={message.id} role={message.role} content={message.content} />
              ))}
              {pendingText !== null ? (
                <>
                  <MessageBubble role="user" content={pendingText} />
                  <TypingIndicator />
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
      </div>
    </div>
  );
}
