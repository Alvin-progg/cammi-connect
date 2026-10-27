"use client";

import Link from "next/link";

export default function DoctorError({
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
          className="mb-6 w-full max-w-md rounded-lg text-base font-semibold tracking-tight text-ink focus-ring"
        >
          CamiConnect
        </Link>
        <div
          role="alert"
          className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-ink text-balance">
            Dashboard unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-secondary text-pretty">
            We could not load your appointments. Nothing was changed. Try again
            in a moment.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover motion-reduce:transition-none"
            >
              Try again
            </button>
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
