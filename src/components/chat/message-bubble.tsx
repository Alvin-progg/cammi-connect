"use client";

import { useEffect, useState } from "react";

import type { BookingEvent, ChatMessagePayload, ChatRole } from "@/lib/chat/schemas";

import { BookingCard, isBookingPayload } from "./booking-cards";
import { CheckCircleIcon, SparkleIcon } from "./icons";

const WORD_INTERVAL_MS = 30;
// Long replies reveal several words per tick so typing never takes much longer than this.
const MAX_REVEAL_MS = 1500;
const TIMER_INTERVAL_MS = 100;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Each chunk is one word plus the whitespace after it, so joining them restores the text. */
function splitWords(text: string): string[] {
  return text.split(/(?<=\s)(?=\S)/);
}

/**
 * Reveals `text` a few words at a time. Returns the full text at once when
 * disabled or when the patient prefers reduced motion.
 */
function useWordReveal(text: string, enabled: boolean): { shown: string; done: boolean } {
  // Decided once on mount: a reply never restarts or toggles its animation.
  const [animate] = useState(() => enabled && !prefersReducedMotion());
  const [shownCount, setShownCount] = useState(0);
  const words = splitWords(text);
  const done = !animate || shownCount >= words.length;
  const wordsPerTick = Math.max(1, Math.ceil((words.length * WORD_INTERVAL_MS) / MAX_REVEAL_MS));

  useEffect(() => {
    if (done) return;
    const timer = setInterval(
      () => setShownCount((count) => count + wordsPerTick),
      WORD_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [done, wordsPerTick]);

  return { shown: done ? text : words.slice(0, shownCount).join(""), done };
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function AssistantAvatar() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
    >
      <SparkleIcon className="size-4" />
    </span>
  );
}

/**
 * One chat message (design.md §6.5). Content is always rendered as React text,
 * never as HTML, so model or patient input cannot inject markup.
 */
export function MessageBubble({
  role,
  content,
  payload = null,
  interactive = false,
  busy = false,
  onEvent = () => {},
  reveal = null,
}: {
  role: ChatRole;
  content: string;
  payload?: ChatMessagePayload | null;
  /** Booking card actions are enabled only on the latest assistant message. */
  interactive?: boolean;
  busy?: boolean;
  onEvent?: (event: BookingEvent) => void;
  /**
   * Set for an assistant reply that arrived in this session: shows how long it
   * took and types the text out. Replies loaded from history render at once.
   */
  reveal?: { elapsedMs: number } | null;
}) {
  if (role === "user") {
    return (
      <li className="flex justify-end">
        <p className="max-w-[65ch] whitespace-pre-wrap break-words rounded-xl bg-primary-soft px-4 py-2.5 text-sm leading-6 text-ink sm:max-w-[80%]">
          {content}
        </p>
      </li>
    );
  }

  return (
    <AssistantMessage
      content={content}
      payload={payload}
      interactive={interactive}
      busy={busy}
      onEvent={onEvent}
      reveal={reveal}
    />
  );
}

/** Split out so the reveal hook is not called conditionally for user messages. */
function AssistantMessage({
  content,
  payload,
  interactive,
  busy,
  onEvent,
  reveal,
}: {
  content: string;
  payload: ChatMessagePayload | null;
  interactive: boolean;
  busy: boolean;
  onEvent: (event: BookingEvent) => void;
  reveal: { elapsedMs: number } | null;
}) {
  const { shown, done } = useWordReveal(content, reveal !== null);
  const textClass = "whitespace-pre-wrap break-words text-[15px] leading-7 text-ink";

  return (
    <li className="flex justify-start gap-3">
      <AssistantAvatar />
      <div className="min-w-0 max-w-[70ch] sm:max-w-[85%]">
        {reveal ? (
          <p className="mb-1.5 flex h-8 items-center gap-1.5 text-xs text-ink-secondary">
            <CheckCircleIcon className="size-4 text-success" />
            Replied in {formatSeconds(reveal.elapsedMs)}
          </p>
        ) : null}
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-xs font-medium text-ink-secondary">CamiConnect</p>
          {done ? (
            <p className={`mt-1.5 ${textClass}`}>{content}</p>
          ) : (
            <>
              {/* Announced once in full; the typing animation is visual only. */}
              <p className="sr-only">{content}</p>
              <p data-testid="reveal-text" aria-hidden="true" className={`mt-1.5 ${textClass}`}>
                {shown}
              </p>
            </>
          )}
          {!done || payload === null ? null : (
            <div className={reveal ? "motion-safe:animate-fade-in" : undefined}>
              {isBookingPayload(payload) ? (
                <BookingCard
                  payload={payload}
                  interactive={interactive}
                  busy={busy}
                  onEvent={onEvent}
                />
              ) : (
                <ReplyPayload payload={payload} />
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function ReplyPayload({
  payload,
}: {
  payload: Extract<ChatMessagePayload, { kind: "sources" | "not_verified" }>;
}) {
  if (payload.kind === "not_verified") {
    return (
      <p
        role="note"
        className="mt-3 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs leading-5 text-warning-soft-ink"
      >
        Not found in the hospital&apos;s information. Please confirm with the hospital directly.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-line pt-2">
      {/* The list carries the accessible name; this is the visual heading. */}
      <p aria-hidden="true" className="text-xs font-medium text-ink-secondary">
        Sources
      </p>
      <ul aria-label="Sources" className="mt-1 space-y-0.5 text-xs leading-5 text-ink-secondary">
        {payload.sources.map((source) => (
          <li key={`${source.slug}:${source.sectionTitle ?? ""}`} className="break-words">
            {source.sectionTitle ? `${source.title} — ${source.sectionTitle}` : source.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shown while the server works on a reply; the live counter is visual only. */
export function AssistantStatus({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TIMER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <li className="flex justify-start gap-3">
      <AssistantAvatar />
      <span className="sr-only">CamiConnect is replying…</span>
      <p aria-hidden="true" className="flex h-8 items-center gap-1.5 text-xs text-ink-secondary">
        <span className="size-3.5 rounded-full border-[1.5px] border-line-strong border-t-accent motion-safe:animate-spin" />
        <span>Thinking…</span>
        <span className="text-ink-muted tabular-nums">·</span>
        <span className="text-ink-muted tabular-nums">{formatSeconds(Math.max(0, now - startedAt))}</span>
      </p>
    </li>
  );
}
