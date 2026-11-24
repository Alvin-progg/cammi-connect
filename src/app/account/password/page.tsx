import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { requireUser } from "@/server/auth/dal";

export const instant = false;

export const metadata: Metadata = { title: "Set your password" };

/**
 * Reached from an invite or password-reset email via /auth/confirm, which has
 * already signed the user in. `?from=account` is the signed-in "Change password"
 * link: same form, returns the user to /account afterwards.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireUser("/account/password");
  const changingFromAccount = (await searchParams).from === "account";

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AuthCard
        title={changingFromAccount ? "Change password" : "Set your password"}
        subtitle={
          changingFromAccount
            ? "Choose a new password for signing in."
            : "Choose a password to finish setting up your account."
        }
      >
        <SetPasswordForm returnTo={changingFromAccount ? "/account" : undefined} />
      </AuthCard>
    </main>
  );
}
