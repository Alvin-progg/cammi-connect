import Link from "next/link";

/**
 * Neutral denial state for signed-in users who are not doctors. It reveals no
 * appointment or resource details, and the response stays HTTP 200 so the
 * route does not advertise whether protected data exists.
 */
export function AccessDenied() {
  return (
    <main id="main" className="relative isolate flex flex-1 bg-wash">
      <div
        aria-hidden="true"
        className="bg-grid-fade pointer-events-none absolute inset-0 -z-10"
      />
      <div className="page-container flex flex-1 flex-col items-center justify-center py-12 lg:py-24">
        <Link
          href="/"
          className="mb-6 w-full max-w-md rounded-lg text-base font-semibold tracking-tight text-ink focus-ring"
        >
          CamiConnect
        </Link>
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight text-ink text-balance">
            Access denied
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-secondary text-pretty">
            This dashboard is only available to doctor accounts.
          </p>
          <Link
            href="/account"
            className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-primary transition-colors hover:bg-primary-soft motion-reduce:transition-none"
          >
            Go to your account
          </Link>
        </div>
      </div>
    </main>
  );
}
