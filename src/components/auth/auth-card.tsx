import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/ui/brand-mark";
import { LinkButton } from "@/components/ui/button";

import { MascotStage } from "./mascot-stage";
import { NurseMascot } from "./nurse-mascot";

/** Top bar shared by the auth pages: wordmark home link and a way back. */
function AuthTopBar() {
  return (
    <header className="mx-auto flex w-full max-w-[1040px] items-center justify-between px-6 pt-6">
      <Link href="/" className="focus-ring flex items-center gap-2.5 rounded-lg">
        <BrandMark className="size-7" />
        <span className="text-[17px] font-semibold tracking-tight text-ink">CamiConnect</span>
      </Link>
      <LinkButton variant="ghost" size="sm" href="/">
        Back to home
      </LinkButton>
    </header>
  );
}

/**
 * Auth page frame (redesign): soft page, top bar, centred card, footnote.
 *
 * - `single` (register, set password): one card; the nurse mascot sits beside
 *   the heading.
 * - `split` (sign in): shadcn two-column login block; the form is on the left
 *   and a decorative panel with the nurse mascot and her greeting is on the
 *   right (hidden below `md`).
 *
 * `MascotStage` lets the nurse react to what the user does in the form. The
 * card holds the page's only <h1>.
 */
export function AuthCard({
  title,
  subtitle,
  eyebrow,
  note,
  variant = "single",
  greeting,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  note?: ReactNode;
  variant?: "single" | "split";
  /** The nurse's speech bubble in the split layout. */
  greeting?: { title: string; text: string };
  children: ReactNode;
}) {
  return (
    <MascotStage className="flex min-h-dvh flex-1 flex-col bg-surface-muted text-ink">
      <AuthTopBar />
      <div className="flex flex-1 items-center justify-center px-4 pb-6 pt-8">
        <div className="flex w-full max-w-[960px] flex-col items-center gap-5">
          {variant === "split" ? (
            <div className="grid w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-lift md:grid-cols-2">
              <div className="flex flex-col gap-5.5 px-6 py-12 sm:px-11">
                <div className="text-center">
                  <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
                  {subtitle ? <p className="mt-1.5 text-ink-secondary">{subtitle}</p> : null}
                </div>
                {children}
              </div>
              <div className="relative hidden min-h-[520px] flex-col justify-between overflow-hidden border-l border-line bg-[linear-gradient(160deg,#e0f2fe_0%,#e9f1ff_50%,#f7f9fd_100%)] px-9 py-10 md:flex">
                <div aria-hidden="true" className="bg-grid-soft absolute inset-0" />
                <div aria-hidden="true" className="relative">
                  <Badge tone="ai" className="bg-surface">
                    Cami · AI assistant
                  </Badge>
                  <p className="mt-3.5 max-w-80 text-2xl font-semibold leading-tight tracking-tight">
                    Ask about services or request an appointment in a few messages.
                  </p>
                </div>
                <div className="relative flex items-end">
                  <NurseMascot size={220} className="-mb-10 -ml-4 rounded-full" />
                  {greeting ? (
                    <div
                      aria-hidden="true"
                      className="-ml-6 mb-[150px] max-w-[220px] rounded-[14px_14px_14px_4px] border border-line bg-surface px-3.5 py-2.5 shadow-[0_12px_24px_-16px_rgb(15_35_66/0.35)]"
                    >
                      <p className="text-sm font-medium">{greeting.title}</p>
                      <p className="text-xs text-ink-muted">{greeting.text}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-lift sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {eyebrow ? <p className="text-sm font-medium text-primary">{eyebrow}</p> : null}
                  <h1 className="mt-1 text-[26px] font-semibold tracking-tight">{title}</h1>
                  {subtitle ? <p className="mt-1 text-ink-secondary">{subtitle}</p> : null}
                </div>
                <NurseMascot size={72} className="shrink-0 rounded-full" />
              </div>
              {children}
            </div>
          )}
          {note ? <p className="max-w-md text-center text-xs leading-5 text-ink-muted">{note}</p> : null}
        </div>
      </div>
    </MascotStage>
  );
}
