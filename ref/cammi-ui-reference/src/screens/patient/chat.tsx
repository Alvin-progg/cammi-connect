import {
  AlertTriangle,
  ArrowUp,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  History,
  Info,
  LogOut,
  PanelLeft,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { StatusBadge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/data";
import { href } from "@/lib/routes";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ shell */

/** Open on desktop; below md it is the 64px rail (the repo overlays the open sidebar on phones). */
function ChatSidebar({ collapsed, active }: { collapsed?: boolean; active: "chat" | "appointments" }) {
  if (!collapsed) {
    return (
      <>
        <div className="md:hidden"><ChatSidebarBody collapsed active={active} /></div>
        <div className="hidden md:flex"><ChatSidebarBody active={active} /></div>
      </>
    );
  }
  return <ChatSidebarBody collapsed active={active} />;
}

function ChatSidebarBody({ collapsed, active }: { collapsed?: boolean; active: "chat" | "appointments" }) {
  const item = "focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm transition-colors";
  if (collapsed) {
    return (
      <aside aria-label="Chat sidebar" className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
        <button type="button" aria-label="Expand sidebar" className="focus-ring inline-flex size-12 items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-muted">
          <PanelLeft aria-hidden className="size-5" />
        </button>
        <a href={href("/chat")} aria-label="New chat" className="focus-ring inline-flex size-12 items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-muted">
          <Plus aria-hidden className="size-5" />
        </a>
        <a
          href={href("/chat/appointments")}
          aria-label="My appointments"
          aria-current={active === "appointments" ? "page" : undefined}
          className={cn("focus-ring inline-flex size-12 items-center justify-center rounded-xl", active === "appointments" ? "bg-primary-soft text-primary" : "text-ink-secondary hover:bg-surface-muted")}
        >
          <CalendarDays aria-hidden className="size-5" />
        </a>
        <Avatar initials="JD" className="mt-auto" />
      </aside>
    );
  }
  return (
    <aside aria-label="Chat sidebar" className="sticky top-0 flex h-dvh w-72 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-3 px-2 pt-3">
        <button type="button" aria-label="Collapse sidebar" className="focus-ring inline-flex size-12 items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-muted">
          <PanelLeft aria-hidden className="size-5" />
        </button>
        <span className="text-[17px] font-semibold tracking-tight">CamiConnect</span>
      </div>
      <nav aria-label="Chat actions" className="mt-2 flex flex-col gap-0.5 px-2">
        <a href={href("/chat")} aria-current={active === "chat" ? "page" : undefined} className={cn(item, active === "chat" ? "bg-primary-soft font-medium text-ink" : "text-ink-secondary hover:bg-surface-muted")}>
          <Plus aria-hidden className="size-5 text-primary" />
          New chat
        </a>
        <button type="button" className={cn(item, "text-ink-secondary hover:bg-surface-muted")}>
          <Search aria-hidden className="size-5" />
          Search chats
        </button>
        <a href={href("/chat/appointments")} className={cn(item, "text-ink-secondary hover:bg-surface-muted")}>
          <CalendarDays aria-hidden className="size-5" />
          My appointments
        </a>
      </nav>
      <div className="mx-3 mt-4 border-t border-line" />
      <p className="px-4 pt-4 text-xs font-medium text-ink-muted">Recent chats</p>
      <ul aria-label="Previous conversations" className="mt-2 flex flex-1 flex-col gap-0.5 px-2">
        {["Pediatrics appointment for my son", "Lab test requirements", "Visiting hours on weekends"].map((title) => (
          <li key={title}>
            <a href={href("/chat/booking")} className="focus-ring block truncate rounded-lg px-3.5 py-2.5 text-sm text-ink-secondary hover:bg-surface-muted">
              {title}
            </a>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t border-line p-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5">
          <Avatar initials="JD" />
          <span className="truncate text-sm font-medium">Juan Dela Cruz</span>
        </div>
        <button type="button" aria-label="Sign out" className="focus-ring inline-flex size-11 items-center justify-center rounded-xl text-ink-secondary hover:bg-surface-muted">
          <LogOut aria-hidden className="size-5" />
        </button>
      </div>
    </aside>
  );
}

function Composer({ draft = "", counter = true }: { draft?: string; counter?: boolean }) {
  const canSend = draft.length > 0;
  return (
    <form className="mx-auto w-full max-w-3xl px-4 pb-4">
      <div className="flex items-end gap-1 rounded-[28px] border border-line-strong bg-surface p-1.5 shadow-card focus-within:border-primary">
        <button type="button" aria-label="Open chat history" className="focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-muted">
          <History aria-hidden className="size-5" />
        </button>
        <label htmlFor="message" className="sr-only">
          Message
        </label>
        <textarea id="message" rows={1} defaultValue={draft} placeholder="Write a message here…" className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-3 text-sm leading-5 outline-none placeholder:text-ink-muted" />
        <button type="submit" aria-label="Send message" className="focus-ring group inline-flex size-11 shrink-0 items-center justify-center rounded-full">
          <span className={cn("inline-flex size-8 items-center justify-center rounded-full border", canSend ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted")}>
            <ArrowUp aria-hidden className="size-4" />
          </span>
        </button>
      </div>
      <div className="mt-2 flex justify-between gap-4 px-3 text-xs leading-5 text-ink-muted">
        <p>AI-generated · not medical advice · not an appointment confirmation</p>
        {counter ? <p className="shrink-0 tabular-nums">{draft.length}/2000</p> : null}
      </div>
    </form>
  );
}

function UserMessage({ children }: { children: ReactNode }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[80%] rounded-xl bg-primary-soft px-4 py-2.5 text-sm leading-6">{children}</p>
    </li>
  );
}

function AssistantMessage({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0 max-w-[85%] flex-1">
        {status ? (
          <p className="mb-1.5 flex h-8 items-center gap-1.5 text-xs text-ink-secondary">
            <CheckCircle2 aria-hidden className="size-4 text-success" />
            {status}
          </p>
        ) : null}
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-xs font-medium text-ink-secondary">CamiConnect</p>
          <div className="mt-1.5 text-sm leading-6">{children}</div>
        </div>
      </div>
    </li>
  );
}

function Thread({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <h1 className="sr-only">Chat with CamiConnect</h1>
      <ol role="log" aria-label="Conversation" aria-live="polite" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8">
        {children}
      </ol>
    </div>
  );
}

function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-ink-muted">{term}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- screens */

const SUGGESTIONS = [
  { icon: <CalendarDays aria-hidden />, tone: "bg-primary-soft text-primary", title: "Book an appointment", text: "Find a doctor by specialty or name and pick an available time.", action: "Start booking", to: "/chat/booking", primary: true },
  { icon: <ClipboardList aria-hidden />, tone: "bg-primary-soft text-primary", title: "My appointments", text: "See the status and details of your upcoming and past visits.", action: "View appointments", to: "/chat/appointments" },
  { icon: <Building2 aria-hidden />, tone: "bg-accent-soft text-accent", title: "Hospital information", text: "Ask about services, departments, requirements and visit guidelines.", action: "Ask a question", to: "/chat/answer" },
];

/** /chat — empty thread (ChatEmptyState). Greeting text comes from chatbot.welcome_message. */
export function ChatWelcomeScreen() {
  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <ChatSidebar active="chat" />
      <main className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(rgb(29_78_216/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(29_78_216/0.05)_1px,transparent_1px)] bg-[size:64px_64px]">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full border border-line bg-surface text-accent shadow-card">
            <Sparkles className="size-5.5" />
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance">
            Good afternoon, <span className="text-ink-muted">Juan</span>
          </h1>
          <p className="mt-2 text-base text-ink-secondary">Hi, I'm Cami! How can I help with your hospital visit today?</p>
          <ul className="mt-10 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
            {SUGGESTIONS.map((s) => (
              <li key={s.title} className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card">
                <span className={cn("inline-flex size-10 items-center justify-center rounded-lg [&_svg]:size-5", s.tone)}>{s.icon}</span>
                <h2 className="mt-3.5 text-base font-semibold">{s.title}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-5 text-ink-muted">{s.text}</p>
                <LinkButton variant={s.primary ? "primary" : "secondary"} href={href(s.to)} className="mt-4 w-full">
                  {s.action}
                </LinkButton>
              </li>
            ))}
          </ul>
        </div>
        <Composer />
      </main>
    </div>
  );
}

const DAYS = [
  { label: "Monday, Nov 9", date: "Monday, November 9, 2026", slots: ["8:30 AM", "9:30 AM", "10:30 AM", "2:00 PM"] },
  { label: "Tuesday, Nov 10", date: "Tuesday, November 10, 2026", slots: ["9:00 AM", "11:00 AM", "1:30 PM", "3:30 PM"] },
];

/** /chat?c=… mid-booking: doctor options, then the slot picker and summary (BookingCard). */
export function ChatBookingScreen() {
  const [picked, setPicked] = useState("Monday, Nov 9|9:30 AM");
  const [day, time] = picked.split("|");
  const date = DAYS.find((d) => d.label === day)?.date;
  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <ChatSidebar collapsed active="chat" />
      <main className="flex min-w-0 flex-1 flex-col">
        <Thread>
          <UserMessage>I'd like to book an appointment for my son. He's had a cough for about a week.</UserMessage>
          <AssistantMessage>
            <p>I can help you request a Pediatrics visit. These doctors have open times this week. Who would you like to see?</p>
            <ul aria-label="Doctors" className="mt-3 flex flex-col gap-2">
              <li>
                <button type="button" disabled className="flex min-h-11 w-full items-center gap-3 rounded-lg border-2 border-primary bg-primary-soft px-3 py-2 text-left">
                  <span className="flex-1">
                    <span className="block font-medium">Dr. Ana Reyes</span>
                    <span className="block text-xs text-ink-secondary">Pediatrics · General pediatrics</span>
                  </span>
                  <Check aria-hidden className="size-4 text-primary" />
                </button>
              </li>
              <li>
                <button type="button" disabled className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-line px-3 py-2 text-left opacity-60">
                  <span className="flex-1">
                    <span className="block font-medium">Dr. Paolo Mendoza</span>
                    <span className="block text-xs text-ink-muted">Pediatrics · Pediatric pulmonology</span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-ink-muted" />
                </button>
              </li>
            </ul>
          </AssistantMessage>
          <AssistantMessage
            status={
              <>
                Checked Dr. Ana Reyes's schedule <span className="tabular-nums text-ink-muted">· 1.8s</span>
              </>
            }
          >
            <p>Dr. Ana Reyes has these open times. Pick one that works for you.</p>
            <div className="mt-3.5 flex flex-col gap-4">
              {DAYS.map((d) => (
                <div key={d.label} role="group" aria-label={d.label}>
                  <p className="text-xs font-medium text-ink-secondary">{d.label}</p>
                  <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {d.slots.map((slot) => {
                      const on = picked === `${d.label}|${slot}`;
                      return (
                        <li key={slot}>
                          <button
                            type="button"
                            aria-pressed={on}
                            onClick={() => setPicked(`${d.label}|${slot}`)}
                            className={cn(
                              "focus-ring pressable inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium tabular-nums",
                              on ? "border-2 border-primary bg-primary-soft" : "border border-line-strong bg-surface hover:bg-primary-soft",
                            )}
                          >
                            {on ? <Check aria-hidden className="size-4 text-primary" /> : null}
                            {slot}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-ink-muted">Times are in Philippine time (Asia/Manila).</p>
              <Button variant="secondary" className="self-start">
                Show later dates
              </Button>
            </div>
            <div className="mt-4 rounded-lg border border-line bg-surface-muted p-3.5">
              <p className="mb-2 font-semibold">Review your request</p>
              <dl className="flex flex-col gap-1.5 text-sm">
                <SummaryRow term="Doctor">Dr. Ana Reyes</SummaryRow>
                <SummaryRow term="Specialty">Pediatrics</SummaryRow>
                <SummaryRow term="Date">{date}</SummaryRow>
                <SummaryRow term="Time">{time} (Asia/Manila)</SummaryRow>
                <SummaryRow term="Reason">Cough for about a week</SummaryRow>
              </dl>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <LinkButton href={href("/chat/answer")}>Confirm booking</LinkButton>
                <Button variant="secondary">Change time</Button>
                <Button variant="ghost">Change doctor</Button>
                <Button variant="ghost">Stop booking</Button>
              </div>
            </div>
            <p className="mt-3.5 border-t border-line pt-2.5 text-xs text-ink-muted">Picking a time sends a request. The front desk still has to confirm it.</p>
          </AssistantMessage>
        </Thread>
        <Composer />
      </main>
    </div>
  );
}

/** Request received + a sourced answer + a fallback, with the sources rail at lg. */
export function ChatAnswerScreen() {
  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <ChatSidebar collapsed active="chat" />
      <main className="flex min-w-0 flex-1 flex-col">
        <Thread>
          <AssistantMessage>
            <div className="rounded-lg border border-line p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">Request received</p>
                <StatusBadge status="requested" />
              </div>
              <dl className="mt-2.5 flex flex-col gap-1.5">
                <SummaryRow term="Doctor">Dr. Ana Reyes</SummaryRow>
                <SummaryRow term="Date">Monday, November 9, 2026</SummaryRow>
                <SummaryRow term="Time">
                  <span className="tabular-nums">9:30 AM – 10:00 AM (Asia/Manila)</span>
                </SummaryRow>
                <SummaryRow term="Reference">
                  <span className="font-mono text-[13px]">REQ-7F3A-2210</span>
                </SummaryRow>
              </dl>
              <p className="mt-2.5 text-xs text-ink-muted">Waiting for the front desk to confirm. The status updates here when it changes.</p>
              <a href={href("/chat/appointments")} className="mt-2 inline-block text-primary underline underline-offset-4">
                View my appointments
              </a>
            </div>
          </AssistantMessage>
          <UserMessage>What do I need to bring if the doctor orders a blood test?</UserMessage>
          <AssistantMessage>
            <p>For a routine blood test at the laboratory, the hospital asks patients to bring:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>The doctor's laboratory request form</li>
              <li>One valid ID (for a minor, the parent or guardian's ID)</li>
              <li>PhilHealth or HMO card, if you'll use one</li>
            </ul>
            <p className="mt-2">Some tests need fasting. Follow the instructions on the request form or ask the laboratory.</p>
            <div className="mt-3 border-t border-line pt-2">
              <p className="text-xs font-medium text-ink-secondary">Sources</p>
              <ul className="mt-1 text-xs leading-5 text-ink-secondary">
                <li>Laboratory services · Requirements for walk-in tests</li>
                <li>Patient guide · PhilHealth and HMO</li>
              </ul>
            </div>
          </AssistantMessage>
          <UserMessage>Is a week-long cough serious?</UserMessage>
          <AssistantMessage>
            <div className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-warning-soft-ink">
              <AlertTriangle aria-hidden className="mt-0.5 size-4.5 shrink-0" />
              <p>I can't assess symptoms or give medical advice. Your request with Dr. Reyes is the right next step. If breathing becomes difficult, go to the Emergency Room right away.</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton variant="secondary" href={href("/chat/appointments")}>
                View my request
              </LinkButton>
              <LinkButton variant="secondary" href="#er">
                Emergency Room information
              </LinkButton>
            </div>
          </AssistantMessage>
        </Thread>
        <Composer draft="Where is the laboratory?" />
      </main>
      <aside aria-label="Sources" className="hidden w-80 shrink-0 flex-col gap-4 border-l border-line bg-surface-muted px-5 py-6 xl:flex">
        <div>
          <p className="text-sm font-medium text-primary">Sources</p>
          <h2 className="mt-1 text-lg font-semibold">Where this answer came from</h2>
          <p className="mt-1 text-[13px] leading-5 text-ink-secondary">Hospital documents the assistant searched. Shown exactly as returned.</p>
        </div>
        {[
          ["Laboratory services", "Requirements for walk-in tests"],
          ["Patient guide", "PhilHealth and HMO"],
        ].map(([title, section]) => (
          <div key={title} className="rounded-xl border border-line bg-surface px-3.5 py-3">
            <p className="font-medium">{title}</p>
            <p className="text-xs text-ink-muted">Section · {section}</p>
          </div>
        ))}
        <div className="flex gap-2.5 rounded-xl border border-line-strong bg-accent-soft px-3.5 py-3 text-[13px] leading-5">
          <Info aria-hidden className="mt-0.5 size-4.5 shrink-0 text-accent" />
          <p>Answers are AI-generated from hospital information. They're not medical advice and don't confirm an appointment.</p>
        </div>
      </aside>
    </div>
  );
}

/** /chat?view=appointments — AppointmentsPanel. */
export function ChatAppointmentsScreen() {
  const upcoming = [
    { day: "9", doctor: "Dr. Ana Reyes", status: "requested" as const, line: "Pediatrics · Mon, Nov 9 · 9:30 – 10:00 AM", ref: "REQ-7F3A-2210", cancel: "Cancel request" },
    { day: "16", doctor: "Dr. Carlo Villanueva", status: "confirmed" as const, line: "Internal medicine · Mon, Nov 16 · 2:00 – 2:30 PM", ref: "APT-91C2-0418", cancel: "Cancel appointment" },
  ];
  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <ChatSidebar collapsed active="appointments" />
      <main className="min-w-0 flex-1">
        <header className="border-b border-line bg-wash">
          <div className="mx-auto flex max-w-[896px] flex-wrap items-end justify-between gap-4 px-6 pb-7 pt-10">
            <div>
              <p className="text-sm font-medium text-primary">Patient portal</p>
              <h1 className="mt-1 text-4xl font-semibold tracking-tight">Your appointments</h1>
              <p className="mt-1.5 text-base text-ink-secondary">Requests stay pending until the front desk confirms them.</p>
            </div>
            <LinkButton href={href("/chat/booking")}>
              <Plus aria-hidden />
              Book with Cami
            </LinkButton>
          </div>
        </header>
        <div className="mx-auto flex max-w-[896px] flex-col gap-8 px-6 pb-12 pt-7">
          <section aria-labelledby="up">
            <h2 id="up" className="text-lg font-semibold">
              Upcoming <span className="font-medium text-ink-muted">· 2</span>
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {upcoming.map((a) => (
                <li key={a.ref} className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-surface px-5 py-4.5 shadow-soft">
                  <div className="w-16 rounded-lg bg-primary-soft py-2 text-center">
                    <p className="text-xs font-medium text-primary">Nov</p>
                    <p className="text-2xl font-semibold leading-tight tabular-nums">{a.day}</p>
                  </div>
                  <div className="min-w-60 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">{a.doctor}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-ink-secondary">{a.line}</p>
                    <p className="mt-1 font-mono text-xs text-ink-muted">{a.ref}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary">Details</Button>
                    <Button variant="ghost" className="text-danger">
                      {a.cancel}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="past">
            <h2 id="past" className="mb-3 text-lg font-semibold">
              Past <span className="font-medium text-ink-muted">· 2</span>
            </h2>
            <Table label="Past appointments">
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Doctor</Th>
                  <Th>Specialty</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                <Tr>
                  <Td className="tabular-nums">Oct 22, 2026</Td>
                  <Td>Dr. Carlo Villanueva</Td>
                  <Td className="text-ink-secondary">Internal medicine</Td>
                  <Td>
                    <StatusBadge status="completed" />
                  </Td>
                </Tr>
                <Tr>
                  <Td className="tabular-nums">Sep 30, 2026</Td>
                  <Td>Dr. Ana Reyes</Td>
                  <Td className="text-ink-secondary">Pediatrics</Td>
                  <Td>
                    <StatusBadge status="cancelled" />
                  </Td>
                </Tr>
              </tbody>
            </Table>
          </section>
        </div>
      </main>
    </div>
  );
}
