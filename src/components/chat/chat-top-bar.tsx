import Link from "next/link";

import { PlusIcon, SearchIcon, SidebarIcon } from "./icons";

const ICON_BUTTON =
  "focus-ring inline-flex size-11 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink motion-reduce:transition-none";

/**
 * Chat top bar. A "Share" action is deliberately absent: sharing a patient's
 * conversation is a privacy decision outside AI-APT-001 S1.
 */
export function ChatTopBar({ onOpenHistory }: { onOpenHistory: () => void }) {
  return (
    <header className="flex items-center justify-between gap-2 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onOpenHistory}
          aria-label="Search chats"
          className={ICON_BUTTON}
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-surface shadow-card">
            <SearchIcon className="size-4" />
          </span>
        </button>
        <Link
          href="/chat"
          className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-ink shadow-card transition-colors hover:bg-surface-muted motion-reduce:transition-none"
        >
          <PlusIcon className="size-4" />
          New Chat
        </Link>
      </div>
      <button
        type="button"
        onClick={onOpenHistory}
        aria-label="Show chat history"
        className={ICON_BUTTON}
      >
        <span className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface shadow-card">
          <SidebarIcon className="size-4" />
        </span>
      </button>
    </header>
  );
}
