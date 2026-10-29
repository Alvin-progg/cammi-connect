import Link from "next/link";
import type { ReactNode } from "react";

import { StethoscopeIcon } from "@/components/doctor/icons";

/**
 * Centered auth layout on the plain white canvas (design.md §6.2): brand
 * lockup, one bordered card holding the page's only <h1>, and an optional
 * note under the card.
 */
export function AuthCard({
  title,
  subtitle,
  note,
  children,
}: {
  title: string;
  subtitle?: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center">
      <Link
        href="/"
        className="focus-ring mb-8 flex items-center gap-2.5 rounded-lg"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-ink shadow-card">
          <StethoscopeIcon className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-ink">
          CamiConnect
        </span>
      </Link>

      <div className="w-full rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink text-balance">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-sm leading-6 text-ink-secondary text-pretty">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-8">{children}</div>
      </div>

      {note ? (
        <p className="mt-6 max-w-sm text-center text-sm leading-6 text-ink-muted text-pretty">
          {note}
        </p>
      ) : null}
    </div>
  );
}
