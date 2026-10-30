"use client";

import { MESSAGE_MAX_LENGTH } from "@/lib/chat/schemas";

import { ArrowUpIcon, ClockIcon } from "./icons";

export function ChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  onOpenHistory,
  isSending,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onOpenHistory: () => void;
  isSending: boolean;
}) {
  const canSend = draft.trim().length > 0 && !isSending;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-3 sm:px-4 sm:pb-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSend) onSubmit();
        }}
        className="flex items-end gap-1 rounded-[1.75rem] border border-line bg-surface p-1.5 shadow-card focus-within:border-line-strong"
      >
        <button
          type="button"
          onClick={onOpenHistory}
          aria-label="Open chat history"
          className="focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink motion-reduce:transition-none"
        >
          <ClockIcon className="size-5" />
        </button>
        <label htmlFor="chat-message" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-message"
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          value={draft}
          placeholder="Write a message here…"
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-5 text-ink outline-none placeholder:text-ink-muted"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="focus-ring group inline-flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <span
            className={`inline-flex size-8 items-center justify-center rounded-full border transition-colors motion-reduce:transition-none ${
              canSend
                ? "border-primary bg-primary text-primary-ink group-hover:bg-primary-hover"
                : "border-line bg-surface text-ink-muted"
            }`}
          >
            <ArrowUpIcon className="size-4" />
          </span>
        </button>
      </form>
      <div className="mt-2 flex items-start justify-between gap-4 px-3 text-xs leading-5 text-ink-muted">
        <p>
          AI-generated · not medical advice · not an appointment confirmation · messages are
          stored and sent to Google Gemini and OpenCode Zen.
        </p>
        <p className="shrink-0 tabular-nums">
          {draft.length}/{MESSAGE_MAX_LENGTH}
        </p>
      </div>
    </div>
  );
}
