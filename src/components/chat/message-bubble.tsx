import type { ChatRole } from "@/lib/chat/schemas";

import { SparkleIcon } from "./icons";

/**
 * One chat message (design.md §6.5). Content is always rendered as React text,
 * never as HTML, so model or patient input cannot inject markup.
 */
export function MessageBubble({ role, content }: { role: ChatRole; content: string }) {
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
      </div>
    </li>
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
