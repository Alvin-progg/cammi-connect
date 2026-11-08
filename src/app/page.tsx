import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import Link from "next/link";

import { BlurText, FadeIn, HeroParallax, RevealDelayed, RevealGroup, RevealItem, RevealListItem, ScrollHeader, ScrollProgressLine, SpotlightCard } from "@/components/landing/landing-motion";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/brand-mark";
import { LinkButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/*
 * Public landing page. Motion (React Bits, landing only — design.md 0.1.2)
 * lives in landing-motion.tsx: Blur Text on the headline, Fade Content on the
 * preview, the steps, and the Calm Care tiles, and Spotlight Card on the
 * service tiles. All of it renders its final state under reduced motion.
 */

const H2 = "text-4xl font-semibold tracking-[-0.03em] text-ink";

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-primary">{children}</p>;
}

function TimeChip({ children, picked, taken }: { children: ReactNode; picked?: boolean; taken?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium tabular-nums",
        picked && "border-2 border-primary bg-primary-soft text-ink",
        taken && "border-line bg-surface-muted text-ink-muted line-through",
        !picked && !taken && "border-line-strong bg-surface text-ink",
      )}
    >
      {children}
    </span>
  );
}

function Header() {
  return (
    <ScrollHeader className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-sm transition-shadow duration-300 data-[scrolled=true]:shadow-[0_6px_16px_-10px_rgb(15_35_66/0.2)]">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-7 px-4 sm:px-8">
        <span className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-ink">
          <BrandMark className="size-7" />
          CamiConnect
        </span>
        <nav aria-label="Main" className="hidden flex-1 gap-1 md:flex">
          {[
            ["How it works", "#how"],
            ["Services", "#services"],
            ["FAQ", "#faq"],
          ].map(([label, to]) => (
            <LinkButton key={to} variant="ghost" size="sm" href={to}>
              {label}
            </LinkButton>
          ))}
        </nav>
        <div className="ml-auto flex gap-2">
          <LinkButton variant="ghost" size="sm" href="/login">
            Sign in
          </LinkButton>
          <LinkButton size="sm" href="/register">
            Create account
          </LinkButton>
        </div>
      </div>
    </ScrollHeader>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-wash">
      <div aria-hidden className="bg-grid-soft absolute inset-0" />
      <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-4 pb-18 pt-22 text-center sm:px-8">
        <Link href="#calm" className="focus-ring inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1 pl-1.5 pr-3 text-xs font-medium text-ink">
          <Badge tone="ai" className="rounded-full">
            New
          </Badge>
          Book with Cami, the hospital&apos;s AI assistant
          <ArrowRight aria-hidden className="size-3.5 text-ink-muted" />
        </Link>
        <h1 className="mt-6 max-w-[860px] text-5xl font-semibold leading-[1.04] tracking-[-0.04em] text-ink sm:text-[64px]">
          <BlurText segments={[{ text: "Care that starts with a" }, { text: "conversation", className: "text-primary" }]} />
        </h1>
        <p className="mt-5 max-w-[620px] text-lg leading-[30px] text-ink-secondary">
          Ask about services and requirements, or request an appointment with a doctor at United Doctors of St. Camillus De Lellis
          Hospital, Mabini. Any time, in a few messages.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton size="lg" href="/chat">
            Chat with Cami
          </LinkButton>
          <LinkButton variant="outline" size="lg" href="#services">
            Browse services
          </LinkButton>
        </div>
        <p className="mt-3.5 text-xs text-ink-muted">No app to install · Answers are AI-generated, not medical advice</p>

        <HeroParallax className="mt-14 w-full max-w-[980px]">
        <FadeIn delay={0.6} className="w-full overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-[0_30px_60px_-30px_rgb(15_35_66/0.3),0_1px_2px_rgb(15_35_66/0.05)]">
          <div className="flex items-center gap-1.5 border-b border-line px-3.5 py-2.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-line" />
            <span className="size-2.5 rounded-full bg-line" />
            <span className="size-2.5 rounded-full bg-line" />
            <span className="ml-2.5 text-xs text-ink-muted">camiconnect · chat</span>
          </div>
          <div className="flex min-h-[360px]">
            <div className="hidden w-55 flex-col gap-1 border-r border-line p-3.5 text-sm md:flex">
              <span className="rounded-lg bg-primary-soft px-3 py-2 font-medium text-primary-hover">New chat</span>
              <span className="px-3 py-2 text-ink-secondary">My appointments</span>
              <span className="px-3 pt-3 text-xs font-medium text-ink-muted">Recent</span>
              <span className="px-3 py-2 text-ink-secondary">Pediatrics for my son</span>
              <span className="px-3 py-2 text-ink-secondary">Lab requirements</span>
            </div>
            <div className="flex flex-1 flex-col gap-3.5 px-7 py-6">
              <p className="self-end rounded-xl bg-primary-soft px-3.5 py-2.5 text-sm text-ink">Is there a pediatrician on Monday morning?</p>
              <div className="max-w-[520px] rounded-xl border border-line px-4 py-3.5">
                <p className="text-xs font-medium text-ink-secondary">CamiConnect</p>
                <p className="mt-1 text-sm text-ink">Dr. Ana Reyes has these open times on Monday, Nov 9.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TimeChip>8:30 AM</TimeChip>
                  <TimeChip picked>9:30 AM</TimeChip>
                  <TimeChip>10:30 AM</TimeChip>
                  <TimeChip>2:00 PM</TimeChip>
                </div>
              </div>
              <div className="mt-auto rounded-full border border-line-strong px-4 py-2.5 text-xs text-ink-muted">Write a message here…</div>
            </div>
          </div>
        </FadeIn>
        </HeroParallax>
      </div>
    </section>
  );
}

function Sign({ label, icon, emergency }: { label: string; icon: ReactNode; emergency?: boolean }) {
  return (
    <div className={cn("flex flex-1 items-center justify-between rounded-xl px-5", emergency ? "bg-surface text-danger" : "bg-white/10 text-white")}>
      {emergency ? icon : null}
      <span className="text-2xl font-semibold tracking-tight">{label}</span>
      {emergency ? null : icon}
    </div>
  );
}

/** The mood board, written for patients: a bento of signage, light and real UI moments. */
function CalmCare() {
  return (
    <section id="calm" className="mx-auto max-w-[1200px] px-4 pt-24 sm:px-8">
      <div className="mx-auto max-w-[640px] text-center">
        <Eyebrow>Calm Care</Eyebrow>
        <h2 className={cn(H2, "mt-2")}>A hospital visit that feels unhurried</h2>
      </div>
      <RevealGroup stagger={0.06} className="mt-12 grid auto-rows-[150px] grid-cols-1 gap-4 md:grid-cols-12">
        <RevealItem className="flex flex-col justify-between rounded-[20px] bg-ink p-8 text-white md:col-span-4 md:row-span-3">
          <p className="font-mono text-xs text-[#93a7c6]">ST. CAMILLUS · MABINI</p>
          <div>
            <p className="text-[56px] font-semibold leading-[0.98] tracking-[-0.05em]">
              Calm
              <br />
              Care
            </p>
            <p className="mt-3.5 leading-[26px] text-[#bccbe3]">Clear answers, real availability, and people who confirm every visit.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Clear", "Unhurried", "Trustworthy"].map((w) => (
              <span key={w} className="rounded-md border border-white/25 bg-white/5 px-2 py-0.5 text-xs font-medium">
                {w}
              </span>
            ))}
          </div>
        </RevealItem>

        <RevealItem role="img" aria-label="Wayfinding signs: Outpatient clinics, Laboratory, Emergency Room" className="group flex flex-col gap-2.5 rounded-[20px] bg-primary p-5.5 md:col-span-5 md:row-span-2">
          <Sign label="Outpatient clinics" icon={<ArrowRight aria-hidden className="size-7 transition-transform duration-300 ease-out motion-safe:group-hover:translate-x-1.5" />} />
          <Sign label="Laboratory" icon={<ArrowUp aria-hidden className="size-7 transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-1.5" />} />
          <Sign label="Emergency Room" icon={<ArrowLeft aria-hidden className="size-7 transition-transform duration-300 ease-out motion-safe:group-hover:-translate-x-1.5" />} emergency />
        </RevealItem>

        <RevealItem className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-5.5 md:col-span-3 md:row-span-2">
          <p className="font-mono text-xs text-ink-muted">ASK CAMI</p>
          <RevealDelayed delay={0.25} className="self-end">
            <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm">What should I bring if I use PhilHealth or an HMO?</p>
          </RevealDelayed>
          <RevealDelayed delay={0.7}>
            <p className="rounded-xl border border-line px-3 py-2 text-sm">Your member ID card and any letter of authorization (LOA) your HMO requires.</p>
          </RevealDelayed>
        </RevealItem>

        <RevealItem aria-hidden className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-line bg-[linear-gradient(160deg,#e0f2fe_0%,#e9f1ff_45%,#ffffff_100%)] p-5.5 md:col-span-3 md:row-span-2">
          <span className="absolute -right-10 -top-10 size-40 rounded-full transition-transform duration-700 ease-out motion-safe:group-hover:scale-150 bg-[radial-gradient(circle,rgb(255_255_255/0.95),transparent_70%)]" />
          <div className="relative grid h-[150px] grid-cols-3 gap-2">
            {[0.7, 0.85, 0.6].map((o) => (
              <span key={o} className="rounded-t-[10px] rounded-b-sm border border-[#cfe0ff]" style={{ background: `rgb(255 255 255 / ${o})` }} />
            ))}
          </div>
          <p className="relative font-mono text-xs text-ink-secondary">BRIGHT · QUIET · CLEAR</p>
        </RevealItem>

        <RevealItem className="relative overflow-hidden rounded-[20px] border border-line bg-wash md:col-span-5 md:row-span-2">
          <div aria-hidden className="bg-grid-soft absolute inset-0" />
          <div className="relative flex flex-col gap-3 p-6.5">
            <p className="font-mono text-xs text-ink-muted">WHAT CAMI WON&apos;T DO</p>
            <ul className="flex flex-col divide-y divide-line text-sm">
              {["Never diagnoses or gives medical advice", 'Never calls a request "booked" before staff confirm it', "Never shares your chat with hospital staff"].map((t, i) => (
                <li key={t} className="flex items-center gap-3 py-2.5">
                  <RevealDelayed delay={0.3 + i * 0.15} className="shrink-0">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
                      <Check aria-hidden className="size-3.5" />
                    </span>
                  </RevealDelayed>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </RevealItem>

        <RevealItem className="flex flex-col justify-center gap-2.5 rounded-[20px] border border-line bg-surface px-5.5 py-5 md:col-span-4">
          <RevealDelayed delay={0.35}>
            <div role="img" aria-label="Example notification: confirmed by the front desk" className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 shadow-[0_12px_28px_-18px_rgb(15_35_66/0.4)]">
              <CheckCircle2 aria-hidden className="mt-0.5 size-4.5 text-success" />
              <div>
                <p className="text-sm font-medium">Confirmed by the front desk</p>
                <p className="text-xs text-ink-muted">Mon, Nov 9 · 9:30 AM · Dr. Ana Reyes</p>
              </div>
            </div>
          </RevealDelayed>
          <p className="text-sm text-ink-secondary">A person checks every request.</p>
        </RevealItem>
      </RevealGroup>
    </section>
  );
}

function Step({ n, height, accent, title, body, children }: { n: string; height: string; accent: string; title: string; body: string; children: ReactNode }) {
  const last = n === "03";
  return (
    <RevealListItem className={cn("flex flex-col rounded-t-[20px] rounded-b-xl border bg-surface p-6 shadow-soft", height, last ? "border-primary shadow-[0_24px_48px_-28px_rgb(26_98_242/0.45)]" : "border-line")}>
      <div className="flex items-center justify-between">
        <span className={cn("text-5xl font-semibold leading-none tracking-[-0.05em]", accent)}>{n}</span>
        <Badge tone={last ? "info" : "neutral"}>Step {Number(n)}</Badge>
      </div>
      <h3 className="mt-4 text-[19px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-secondary">{body}</p>
      <div className="mt-auto pt-4">{children}</div>
    </RevealListItem>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1200px] px-4 pt-28 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[560px]">
          <Eyebrow>How it works</Eyebrow>
          <h2 className={cn(H2, "mt-2")}>From question to appointment in three steps</h2>
        </div>
        <p className="max-w-[360px] text-sm text-ink-secondary">Each step is a message or a tap. Nothing is booked until the hospital confirms it.</p>
      </div>
      {/* Stair layout: each step is taller than the last and they share a baseline. */}
      <ScrollProgressLine className="mt-14">
        <RevealGroup as="ol" stagger={0.15} className="relative grid items-end gap-4 md:grid-cols-3">
          <Step n="01" height="md:h-[300px]" accent="text-line-strong" title="Tell Cami what you need" body="A specialty, a doctor's name, or your concern in your own words.">
            <p className="ml-auto w-fit rounded-xl bg-primary-soft px-3 py-2 text-sm">My son has had a cough for a week</p>
          </Step>
          <Step n="02" height="md:h-[380px]" accent="text-[#9dbcf8]" title="Pick an open time" body="Only real openings from the doctor's schedule, in Philippine time.">
            <div className="grid grid-cols-3 gap-2">
              <TimeChip>8:30</TimeChip>
              <TimeChip picked>9:30</TimeChip>
              <TimeChip>10:30</TimeChip>
              <TimeChip>1:00</TimeChip>
              <TimeChip>2:00</TimeChip>
              <TimeChip taken>3:30</TimeChip>
            </div>
          </Step>
          <Step n="03" height="md:h-[460px]" accent="text-primary" title="The front desk confirms" body="They check it against the doctor's schedule. You see the status change in My appointments.">
            <ol className="flex flex-col gap-3 border-l-2 border-line pl-5 text-sm">
              {[
                ["Request sent", <Badge key="a" tone="warning">Pending confirmation</Badge>],
                ["Front desk reviewed", <span key="b" className="text-xs text-ink-muted tabular-nums">2:40 PM</span>],
                ["Mon, Nov 9 · 9:30 AM", <Badge key="c" tone="info">Confirmed</Badge>],
              ].map(([label, right], i) => (
                <li key={i} className="relative flex items-center justify-between gap-2">
                  <span aria-hidden className="absolute -left-[27px] size-3 rounded-full bg-primary" />
                  <span className="font-medium">{label}</span>
                  {right}
                </li>
              ))}
            </ol>
          </Step>
        </RevealGroup>
      </ScrollProgressLine>
    </section>
  );
}

function Services() {
  const tile = "rounded-[20px] border border-line bg-surface shadow-soft";
  return (
    <section id="services" className="mx-auto max-w-[1200px] px-4 py-24 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>What you can do</Eyebrow>
          <h2 className={cn(H2, "mt-2")}>Everything for your visit, in one chat</h2>
        </div>
        <LinkButton variant="outline" size="sm" href="/chat">
          Open chat
        </LinkButton>
      </div>
      {/* Bento: one large tile, two stacked, then a narrow + wide row. Spotlight Card on hover. */}
      <div className="mt-10 grid auto-rows-[minmax(190px,auto)] grid-cols-1 gap-4 md:grid-cols-12">
        <SpotlightCard className={cn(tile, "flex flex-col gap-2.5 overflow-hidden p-8 md:col-span-7 md:row-span-2")}>
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <CalendarDays aria-hidden className="size-4.5" />
          </span>
          <h3 className="text-2xl font-semibold tracking-tight">Request appointments</h3>
          <p className="max-w-[420px] text-ink-secondary">Choose a specialty and a doctor, then pick a time from their real schedule. Change or cancel later.</p>
          <div className="-mb-8 -mr-8 mt-auto flex flex-col gap-3 rounded-tl-[14px] border-l border-t border-line bg-[#f7f9fd] p-5">
            <div className="flex flex-wrap gap-2">
              {["Pediatrics", "Internal medicine", "OB-GYN", "Surgery"].map((s, i) => (
                <span key={s} className={cn("inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium", i === 0 ? "border-primary bg-primary-soft" : "border-line-strong bg-surface")}>
                  {s}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
              <Avatar initials="AR" />
              <div className="flex-1">
                <p className="text-sm font-medium">Dr. Ana Reyes</p>
                <p className="text-xs text-ink-muted">General pediatrics · next open Mon 8:30 AM</p>
              </div>
              <span className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-ink">Pick a time</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 opacity-70">
              <Avatar initials="PM" />
              <div>
                <p className="text-sm font-medium">Dr. Paolo Mendoza</p>
                <p className="text-xs text-ink-muted">Pediatric pulmonology · next open Wed 1:00 PM</p>
              </div>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="flex flex-col gap-2.5 rounded-[20px] bg-ink p-7 text-white md:col-span-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-white/10 text-[#7dd3fc]">
              <Sparkles aria-hidden className="size-4.5" />
            </span>
            <span className="font-mono text-xs text-[#93a7c6]">SOURCE · LABORATORY SERVICES</span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight">Ask about the hospital</h3>
          <p className="text-[#bccbe3]">Requirements, PhilHealth and HMO, visiting hours. Every answer shows where it came from.</p>
        </SpotlightCard>

        <SpotlightCard className={cn(tile, "flex flex-col gap-2.5 p-7 md:col-span-5")}>
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-success-soft text-success">
            <ClipboardCheck aria-hidden className="size-4.5" />
          </span>
          <h3 className="text-xl font-semibold tracking-tight">Track every visit</h3>
          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            <Badge tone="warning">Pending confirmation</Badge>
            <ArrowRight aria-hidden className="size-3.5 text-ink-muted" />
            <Badge tone="info">Confirmed</Badge>
            <ArrowRight aria-hidden className="size-3.5 text-ink-muted" />
            <Badge tone="success">Completed</Badge>
          </div>
        </SpotlightCard>

        <SpotlightCard className="flex flex-col gap-2 rounded-[20px] border border-[#cfe0ff] bg-primary-soft p-7 md:col-span-4">
          <p className="text-[44px] font-semibold leading-none tracking-[-0.05em] text-primary-hover">Any time</p>
          <h3 className="text-lg font-semibold">Ask any time</h3>
          <p className="text-sm text-ink-secondary">Cami answers at night and on weekends. Staff confirm requests during clinic hours.</p>
        </SpotlightCard>

        <SpotlightCard className={cn(tile, "flex items-center gap-7 overflow-hidden p-7 md:col-span-8")}>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Works in your phone&apos;s browser</h3>
            <p className="mt-1.5 text-sm text-ink-secondary">No app to install. Open the site, sign in, and chat.</p>
            <LinkButton size="sm" href="/register" className="mt-4">
              Create an account
            </LinkButton>
          </div>
          <div aria-hidden className="-mb-16 hidden h-[150px] w-[180px] shrink-0 flex-col gap-2 self-end rounded-t-[22px] border border-b-0 border-line-strong bg-surface px-3 py-3.5 sm:flex">
            <span className="h-1 w-10 self-center rounded-full bg-line" />
            <span className="h-5.5 w-[70%] self-end rounded-lg bg-primary-soft" />
            <span className="h-10 w-[85%] rounded-lg border border-line" />
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    [
      "Do I need an account?",
      "Yes. Sign in with a patient account to chat with Cami and request appointments, so the hospital can reach you about your visit.",
    ],
    [
      "How do I know my appointment is confirmed?",
      "Every request starts as Pending confirmation. The front desk checks it against the doctor's schedule, and the status changes to Confirmed in My appointments.",
    ],
    [
      "What if Cami can't answer my question?",
      "Cami answers only from the hospital's published information. If it can't verify an answer, it says so and asks you to contact the hospital directly.",
    ],
    [
      "Can I cancel an appointment?",
      "Yes. Open My appointments in the chat and cancel the appointment you no longer need.",
    ],
  ];
  return (
    <section id="faq" className="mx-auto max-w-[800px] px-4 py-20 sm:px-8">
      <h2 className="text-center text-[32px] font-semibold tracking-[-0.03em]">Questions</h2>
      <div className="mt-8 border-t border-line">
        {items.map(([q, a], i) => (
          <details key={q} open={i === 0} className="group border-b border-line py-4.5">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between font-medium">
              {q}
              <ArrowDown aria-hidden className="size-4 text-ink-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2.5 text-ink-secondary">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <Header />
      <main id="main">
      <Hero />
      <CalmCare />
      <HowItWorks />
      <Services />
      <Faq />
      <section className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-ink px-8 py-14 text-white sm:px-12">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">Ready when you are</h2>
            <p className="mt-2 text-[#bccbe3]">Ask your first question in under a minute.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/chat" className="focus-ring pressable inline-flex min-h-11 items-center rounded-lg bg-white px-6 text-sm font-medium text-ink">
              Chat with Cami
            </Link>
            <Link href="/register" className="focus-ring pressable inline-flex min-h-11 items-center rounded-lg border border-white/30 px-6 text-sm font-medium text-white">
              Create account
            </Link>
          </div>
        </div>
      </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 px-4 pb-8 pt-6 text-xs text-ink-muted sm:px-8">
          <span>CamiConnect · United Doctors of St. Camillus De Lellis Hospital, Mabini</span>
          <span>In an emergency, go to the nearest Emergency Room.</span>
        </div>
      </footer>
    </div>
  );
}
