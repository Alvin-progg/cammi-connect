import Link from "next/link";
import type { ReactNode } from "react";

import { BuildingIcon, CalendarIcon, ClipboardIcon, SparkleIcon } from "./icons";

type Suggestion = {
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
} & ({ kind: "message"; message: string } | { kind: "link"; href: string });

const ACTION_CLASS =
  "focus-ring mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-line bg-surface text-sm font-medium text-ink shadow-card transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

const SUGGESTIONS: Suggestion[] = [
  {
    icon: <CalendarIcon className="size-5" />,
    title: "Book an Appointment",
    description: "Find a doctor by specialty or name and pick an available time.",
    action: "Start Booking",
    kind: "message",
    message: "I'd like to book an appointment.",
  },
  {
    icon: <ClipboardIcon className="size-5" />,
    title: "My Appointments",
    description: "See the status and details of your upcoming and past visits.",
    action: "View Appointments",
    kind: "link",
    href: "/chat?view=appointments",
  },
  {
    icon: <BuildingIcon className="size-5" />,
    title: "Hospital Information",
    description: "Ask about services, departments, requirements, and visit guidelines.",
    action: "Ask a Question",
    kind: "message",
    message: "I have a question about the hospital.",
  },
];

export function ChatEmptyState({
  salutation,
  firstName,
  disabled,
  onSuggestion,
}: {
  salutation: string;
  firstName: string;
  disabled: boolean;
  onSuggestion: (message: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <span className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-accent shadow-card">
        <SparkleIcon className="size-5" />
      </span>
      <h1 className="mt-4 text-3xl font-medium tracking-tight text-ink text-balance">
        {salutation}, <span className="text-ink-muted">{firstName}</span>
      </h1>
      <p className="mt-2 text-sm text-ink-secondary">
        Hi there! How can I help with your hospital visit today?
      </p>

      <ul className="mt-8 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
        {SUGGESTIONS.map((suggestion) => (
          <li
            key={suggestion.title}
            className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card"
          >
            <span className="text-ink-secondary">{suggestion.icon}</span>
            <h2 className="mt-3 text-base font-semibold text-ink">{suggestion.title}</h2>
            <p className="mt-1.5 flex-1 text-sm leading-5 text-ink-muted">
              {suggestion.description}
            </p>
            {suggestion.kind === "link" ? (
              <Link href={suggestion.href} className={ACTION_CLASS}>
                {suggestion.action}
              </Link>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSuggestion(suggestion.message)}
                className={ACTION_CLASS}
              >
                {suggestion.action}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
