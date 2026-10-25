import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
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
            Your account
          </h1>
          <Suspense
            fallback={
              <p className="mt-4 text-sm leading-6 text-ink-muted">Loading…</p>
            }
          >
            <AccountDetails />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function AccountDetails() {
  const user = await requireUser("/account");
  return (
    <div className="mt-4 flex flex-col items-start gap-4">
      <p className="text-sm leading-6 text-ink-secondary">
        Signed in as{" "}
        <strong className="font-semibold text-ink">{user.email}</strong>
      </p>
      <SignOutButton />
    </div>
  );
}
