import type { Metadata } from "next";

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
    <main id="main" className="flex flex-1 flex-col bg-canvas">
      <div className="page-container flex flex-1 flex-col items-center justify-center py-12 lg:py-20">
        <AuthCard
          title="Sign in"
          subtitle="Welcome back. Sign in to manage your appointments."
          note="Doctors and hospital staff sign in here with the account provided by the hospital."
        >
          <LoginForm
            next={typeof next === "string" ? next : undefined}
            callbackError={error === "callback" ? CALLBACK_ERROR_MESSAGE : undefined}
          />
        </AuthCard>
      </div>
    </main>
  );
}
