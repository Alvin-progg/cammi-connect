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
    <main id="main" className="flex flex-1 flex-col">
      <AuthCard
        variant="split"
        title="Welcome back"
        subtitle="Sign in to your CamiConnect account"
        greeting={{
          title: "Good to see you again!",
          text: "I'll look away while you type your password.",
        }}
        note="Cami's answers are AI-generated and not medical advice."
      >
        <LoginForm
          next={typeof next === "string" ? next : undefined}
          callbackError={error === "callback" ? CALLBACK_ERROR_MESSAGE : undefined}
        />
      </AuthCard>
    </main>
  );
}
