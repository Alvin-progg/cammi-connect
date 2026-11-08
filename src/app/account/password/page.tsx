import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { requireUser } from "@/server/auth/dal";

export const instant = false;

export const metadata: Metadata = { title: "Set your password" };

/**
 * Reached from an invite or password-reset email via /auth/confirm, which has
 * already signed the user in.
 */
export default async function SetPasswordPage() {
  await requireUser("/account/password");

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AuthCard
        title="Set your password"
        subtitle="Choose a password to finish setting up your account."
      >
        <SetPasswordForm />
      </AuthCard>
    </main>
  );
}
