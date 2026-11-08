"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand-mark";

export default function FrontDeskError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="flex flex-1 flex-col bg-canvas">
      <div className="page-container flex flex-1 flex-col items-center justify-center py-12 lg:py-24">
        <Link
          href="/"
          className="mb-6 flex w-full max-w-md items-center gap-2.5 rounded-lg text-base font-semibold tracking-tight text-ink focus-ring"
        >
          <BrandMark className="size-7" />
          CamiConnect
        </Link>
        <div
          role="alert"
          className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-ink text-balance">
            Front desk unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-secondary text-pretty">
            We could not load the front desk. Nothing was changed. Try
            again in a moment.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <Link
              href="/account"
              className="rounded-lg text-sm font-medium text-primary underline underline-offset-4 focus-ring hover:text-primary-hover"
            >
              Go to your account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
