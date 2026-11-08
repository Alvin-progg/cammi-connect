import Link from "next/link";
import type { ReactNode } from "react";

import { Building2Icon, CalendarIcon, ClipboardListIcon, SparklesIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Suggestion = {
  icon: ReactNode;
  /** Icon tile tint; the hospital-information card uses the AI accent. */
  tone: "primary" | "ai";
  /** The main call to action gets the primary button. */
  primary?: boolean;
  title: string;
  description: string;
  action: string;
} & ({ kind: "message"; message: string } | { kind: "link"; href: string });

const TONE_CLASS = { primary: "bg-primary-soft text-primary", ai: "bg-accent-soft text-accent" };

const SUGGESTIONS: Suggestion[] = [
  {
    icon: <CalendarIcon aria-hidden="true" />,
    tone: "primary",
    primary: true,
    title: "Book an Appointment",
    description: "Find a doctor by specialty or name and pick an available time.",
    action: "Start Booking",
    kind: "message",
    message: "I'd like to book an appointment.",
  },
  {
    icon: <ClipboardListIcon aria-hidden="true" />,
    tone: "primary",
    title: "My Appointments",
    description: "See the status and details of your upcoming and past visits.",
    action: "View Appointments",
    kind: "link",
    href: "/chat?view=appointments",
  },
  {
    icon: <Building2Icon aria-hidden="true" />,
    tone: "ai",
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
  welcomeMessage,
  disabled,
  onSuggestion,
}: {
  salutation: string;
  firstName: string;
  welcomeMessage: string;
  disabled: boolean;
  onSuggestion: (message: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[linear-gradient(rgb(29_78_216/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(29_78_216/0.05)_1px,transparent_1px)] bg-[size:64px_64px] px-4 py-12 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full border border-line bg-surface text-accent shadow-card">
        <SparklesIcon aria-hidden="true" className="size-5.5" />
      </span>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight text-ink text-balance">
        {salutation}, <span className="text-ink-muted">{firstName}</span>
      </h1>
      <p className="mt-2 max-w-xl text-base text-ink-secondary">{welcomeMessage}</p>

      <ul className="mt-10 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
        {SUGGESTIONS.map((suggestion) => (
          <li
            key={suggestion.title}
            className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card"
          >
            <span
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-lg [&_svg]:size-5",
                TONE_CLASS[suggestion.tone],
              )}
            >
              {suggestion.icon}
            </span>
            <h2 className="mt-3.5 text-base font-semibold text-ink">{suggestion.title}</h2>
            <p className="mt-1.5 flex-1 text-sm leading-5 text-ink-muted">
              {suggestion.description}
            </p>
            {suggestion.kind === "link" ? (
              <Link href={suggestion.href} className={buttonVariants({ variant: "secondary", className: "mt-4 w-full" })}>
                {suggestion.action}
              </Link>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSuggestion(suggestion.message)}
                className={buttonVariants({
                  variant: suggestion.primary ? "primary" : "secondary",
                  className: "mt-4 w-full",
                })}
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
