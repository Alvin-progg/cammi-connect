"use client";

import Link from "next/link";
import { useState } from "react";

import type { ConversationSummary } from "@/lib/chat/schemas";
import { signOutAction } from "@/server/auth/actions";

import { CalendarIcon, LogOutIcon, PanelLeftIcon, SearchIcon, PlusIcon } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";

/**
 * Width and label visibility are driven by `data-state` on the aside:
 * - "auto" (server render, before the breakpoint is known): open from `md`, a rail below;
 * - "open" / "closed": the patient's explicit choice or the measured breakpoint.
 * Using CSS for "auto" avoids a flash or layout shift on first paint.
 */
export type SidebarState = "auto" | "open" | "closed";

const LABEL =
  "truncate whitespace-nowrap opacity-0 transition-opacity duration-150 motion-reduce:transition-none group-data-[state=open]:opacity-100 md:group-data-[state=auto]:opacity-100";

const ROW =
  "focus-ring flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink motion-reduce:transition-none";

const ICON_SLOT = "inline-flex size-8 shrink-0 items-center justify-center";

/** Up to two initials for the account avatar; "?" when the name yields none. */
function initialsOf(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export function ChatSidebar({
  state,
  onToggle,
  onExpand,
  onNavigate,
  searchOpen,
  onSearchOpenChange,
  conversations,
  activeConversationId,
  appointmentsActive,
  patientName,
}: {
  state: SidebarState;
  onToggle: () => void;
  onExpand: () => void;
  /** Called when a link is followed, so a mobile overlay can close. */
  onNavigate: () => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  appointmentsActive: boolean;
  /** The signed-in patient, shown in the account footer. */
  patientName: string;
}) {
  const [query, setQuery] = useState("");
  const isOpen = state === "open";

  const normalizedQuery = searchOpen ? query.trim().toLowerCase() : "";
  const matches = normalizedQuery
    ? conversations.filter((conversation) =>
        conversation.title.toLowerCase().includes(normalizedQuery),
      )
    : conversations;

  return (
    <aside
      data-state={state}
      aria-label="Chat sidebar"
      className="group fixed inset-y-0 left-0 z-40 flex h-dvh w-16 flex-col overflow-hidden border-r border-line bg-surface transition-[width] duration-200 ease-out motion-reduce:transition-none data-[state=open]:w-72 data-[state=open]:shadow-overlay md:static md:data-[state=auto]:w-72 md:data-[state=open]:shadow-none"
    >
      <div className="flex items-center gap-3 px-2 pt-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={state === "auto" ? undefined : isOpen}
          className="focus-ring inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink motion-reduce:transition-none"
        >
          <PanelLeftIcon className="size-5" />
        </button>
        <span className={`${LABEL} flex items-center gap-2.5 text-base font-semibold tracking-tight text-ink`}>
          <BrandMark className="size-7" />
          CamiConnect
        </span>
      </div>

      <nav aria-label="Chat actions" className="mt-2 flex flex-col gap-0.5 px-2">
        <Link href="/chat" onClick={onNavigate} className={ROW}>
          <span className={ICON_SLOT}>
            <PlusIcon aria-hidden="true" className="size-5 text-primary" />
          </span>
          <span className={LABEL}>New conversation</span>
        </Link>
        <button
          type="button"
          onClick={() => {
            onExpand();
            onSearchOpenChange(!searchOpen || !isOpen);
          }}
          aria-expanded={searchOpen}
          className={ROW}
        >
          <span className={ICON_SLOT}>
            <SearchIcon className="size-5" />
          </span>
          <span className={LABEL}>Search chats</span>
        </button>
        <Link
          href="/chat?view=appointments"
          aria-current={appointmentsActive ? "page" : undefined}
          onClick={onNavigate}
          className={`${ROW} ${appointmentsActive ? "bg-primary-soft text-ink" : ""}`}
        >
          <span className={ICON_SLOT}>
            <CalendarIcon className="size-5" />
          </span>
          <span className={LABEL}>My appointments</span>
        </Link>
        {searchOpen && isOpen ? (
          <input
            type="search"
            autoFocus
            aria-label="Search conversations"
            placeholder="Search conversations"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onSearchOpenChange(false);
            }}
            className="focus-ring mx-1 mt-1 min-h-10 rounded-xl border border-control-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted"
          />
        ) : null}
      </nav>

      {/* Text-only list: hidden (and inert) on the collapsed rail. */}
      <div
        inert={state === "closed"}
        className="invisible flex min-h-0 flex-1 flex-col opacity-0 transition-[opacity,visibility] duration-150 motion-reduce:transition-none group-data-[state=open]:visible group-data-[state=open]:opacity-100 md:group-data-[state=auto]:visible md:group-data-[state=auto]:opacity-100"
      >
        <div className="mx-3 mt-4 border-t border-line" />

        <p className="mt-4 whitespace-nowrap px-4 text-[0.6875rem] font-medium uppercase tracking-wider text-ink-muted">
          Previous conversations
        </p>

        <nav
          aria-label="Previous conversations"
          className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4"
        >
          {matches.length === 0 ? (
            <p className="whitespace-nowrap px-3 py-3 text-sm text-ink-muted">
              {conversations.length === 0 ? "No conversations yet." : "No conversations match."}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {matches.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                return (
                  <li key={conversation.id}>
                    <Link
                      href={`/chat?c=${conversation.id}`}
                      title={conversation.title}
                      aria-current={isActive ? "page" : undefined}
                      onClick={onNavigate}
                      className={`focus-ring flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors motion-reduce:transition-none ${
                        isActive
                          ? "bg-primary-soft font-semibold text-ink"
                          : "font-medium text-ink-secondary hover:bg-surface-muted hover:text-ink"
                      }`}
                    >
                      <span className="truncate whitespace-nowrap">{conversation.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </div>

      {/*
       * Stays outside the inert list wrapper so it remains usable on the rail.
       * The rail is too narrow for two icon slots side by side, so the row only
       * becomes horizontal once the sidebar is open.
       */}
      <div className="flex shrink-0 flex-col gap-0.5 border-t border-line px-2 py-2 group-data-[state=open]:flex-row group-data-[state=open]:items-center md:group-data-[state=auto]:flex-row md:group-data-[state=auto]:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className={`${ICON_SLOT} rounded-full bg-accent-soft text-xs font-semibold text-accent`}
          >
            {initialsOf(patientName)}
          </span>
          <span className={`${LABEL} text-sm font-medium text-ink`}>{patientName}</span>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className={`${ROW} w-auto justify-center text-ink-muted hover:bg-danger-soft hover:text-danger-soft-ink`}
          >
            <span className={ICON_SLOT}>
              <LogOutIcon className="size-5" />
            </span>
          </button>
        </form>
      </div>
    </aside>
  );
}
