import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

const CALLBACK_ERROR_MESSAGE = "Unable to sign in. Please try again.";

type LoginSearchParams = {
  next?: string | string[];
  error?: string | string[];
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const { next, error } = await searchParams;

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
        <AuthCard title="Sign in" subtitle="Sign in to your CamiConnect account.">
          <LoginForm
            next={typeof next === "string" ? next : undefined}
            callbackError={error === "callback" ? CALLBACK_ERROR_MESSAGE : undefined}
          />
        </AuthCard>
      </div>
    </main>
  );
}
