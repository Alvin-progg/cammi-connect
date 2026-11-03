import Link from "next/link";
import type { ReactNode } from "react";

import { StethoscopeIcon } from "@/components/doctor/icons";

import { HospitalIllustration } from "./hospital-illustration";
import { MascotStage } from "./mascot-stage";
import { NurseMascot } from "./nurse-mascot";

/**
 * Split-screen auth layout (design.md §6.2, amendment 2026-11-03). On large
 * screens a decorative hospital illustration fills the left panel and the
 * form sits in a white rounded panel on the right. Below `lg` only the form
 * panel shows. The panel holds the page's only <h1>. `MascotStage` lets the
 * illustration react to what the user does in the form.
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
    <MascotStage className="grid flex-1 bg-surface lg:grid-cols-12 lg:bg-surface-muted lg:p-4">
      <div className="hidden flex-col items-center justify-center gap-10 px-10 py-12 lg:col-span-7 lg:flex">
        <HospitalIllustration className="w-full max-w-xl" />
        <div className="max-w-md text-center">
          <p className="text-2xl font-semibold tracking-tight text-ink text-balance">
            Care that&apos;s easy to reach.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-secondary text-pretty">
            Book, follow, and manage your hospital appointments in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-col px-4 py-10 sm:px-10 lg:col-span-5 lg:rounded-3xl lg:bg-surface lg:shadow-card">
        <Link
          href="/"
          className="focus-ring mx-auto flex items-center gap-2.5 rounded-lg"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-ink shadow-card">
            <StethoscopeIcon className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-ink">
            CamiConnect
          </span>
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="text-center">
            <NurseMascot />
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink text-balance sm:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 text-sm leading-6 text-ink-secondary text-pretty">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="mt-10">{children}</div>
        </div>

        {note ? (
          <p className="mx-auto max-w-sm text-center text-xs leading-5 text-ink-muted text-pretty">
            {note}
          </p>
        ) : null}
      </div>
    </MascotStage>
  );
}
