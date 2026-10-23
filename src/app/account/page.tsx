import type { Metadata } from "next";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <main className="flex-1 px-4 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Your account</h1>
        <Suspense fallback={<p className="mt-4 text-sm text-zinc-600">Loading…</p>}>
          <AccountDetails />
        </Suspense>
      </div>
    </main>
  );
}

async function AccountDetails() {
  const user = await requireUser("/account");
  return (
    <div className="mt-4 flex flex-col items-start gap-4">
      <p className="text-sm text-zinc-700">
        Signed in as <strong>{user.email}</strong>
      </p>
      <SignOutButton />
    </div>
  );
}
