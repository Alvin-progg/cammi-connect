"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatManilaShortDate } from "@/lib/appointments/format";
import type { ConversationSummary } from "@/lib/chat/schemas";

import { CloseIcon } from "./icons";

/** Slide-over list of the patient's past chats with a client-side title search. */
export function HistoryDrawer({
  open,
  onClose,
  conversations,
  activeConversationId,
}: {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery
    ? conversations.filter((conversation) =>
        conversation.title.toLowerCase().includes(normalizedQuery),
      )
    : conversations;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="chat-history-title"
      className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[min(22rem,calc(100%-3rem))] max-w-none border-r border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-overlay"
      onClose={() => {
        setQuery("");
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
    >
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-4 pt-4">
            <h2 id="chat-history-title" className="text-base font-semibold text-ink">
              Chat history
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close chat history"
              className="focus-ring inline-flex size-11 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink motion-reduce:transition-none"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>
          <div className="px-4 pb-3 pt-2">
            <input
              type="search"
              autoFocus
              aria-label="Search chats"
              placeholder="Search chats"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="focus-ring min-h-11 w-full rounded-full border border-control-line bg-surface px-4 text-sm text-ink placeholder:text-ink-muted"
            />
          </div>
          <nav aria-label="Past chats" className="flex-1 overflow-y-auto px-2 pb-4">
            {matches.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-muted">
                {conversations.length === 0 ? "No chats yet." : "No chats match your search."}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {matches.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  return (
                    <li key={conversation.id}>
                      <Link
                        href={`/chat?c=${conversation.id}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => dialogRef.current?.close()}
                        className={`focus-ring flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 transition-colors motion-reduce:transition-none ${
                          isActive ? "bg-primary-soft" : "hover:bg-surface-muted"
                        }`}
                      >
                        <span className="truncate text-sm font-medium text-ink">
                          {conversation.title}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {formatManilaShortDate(conversation.updatedAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </div>
      ) : null}
    </dialog>
  );
}
