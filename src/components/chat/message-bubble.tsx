import type { BookingEvent, ChatMessagePayload, ChatRole } from "@/lib/chat/schemas";

import { BookingCard, isBookingPayload } from "./booking-cards";
import { SparkleIcon } from "./icons";

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
}: {
  role: ChatRole;
  content: string;
  payload?: ChatMessagePayload | null;
  /** Booking card actions are enabled only on the latest assistant message. */
  interactive?: boolean;
  busy?: boolean;
  onEvent?: (event: BookingEvent) => void;
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
    <li className="flex justify-start">
      <div className="max-w-[70ch] rounded-xl border border-line bg-surface px-4 py-3 sm:max-w-[85%]">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
          <SparkleIcon className="size-3.5 text-accent" />
          CamiConnect
        </p>
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-ink">
          {content}
        </p>
        {payload === null ? null : isBookingPayload(payload) ? (
          <BookingCard payload={payload} interactive={interactive} busy={busy} onEvent={onEvent} />
        ) : (
          <ReplyPayload payload={payload} />
        )}
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

export function TypingIndicator() {
  return (
    <li className="flex justify-start">
      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <span className="sr-only">CamiConnect is replying…</span>
        <span aria-hidden="true" className="flex gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              style={{ animationDelay: `${delay}ms` }}
              className="size-1.5 rounded-full bg-ink-muted motion-safe:animate-bounce"
            />
          ))}
        </span>
      </div>
    </li>
  );
}
