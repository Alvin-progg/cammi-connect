import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Suspense } from "react";

import { LinkButton, buttonVariants } from "@/components/ui/button";
import { Avatar, Card, CardHeader } from "@/components/ui/card";
import { ListRow, ListRows } from "@/components/ui/data";
import { initialsOf } from "@/components/ui/rail";
import { requireUser } from "@/server/auth/dal";
import { signOutAction } from "@/server/auth/actions";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-8">
        <span className="text-[17px] font-semibold tracking-tight">CamiConnect</span>
        <LinkButton variant="outline" size="sm" href="/">
          Back to home
        </LinkButton>
      </header>
      <Suspense
        fallback={
          <main id="main" className="mx-auto w-full max-w-[880px] px-6 pt-10">
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="mt-4 text-sm text-ink-muted">Loading…</p>
          </main>
        }
      >
        <AccountDetails />
      </Suspense>
    </div>
  );
}

async function AccountDetails() {
  const user = await requireUser("/account");
  const email = user.email;
  return (
    <>
      <div className="border-b border-line bg-wash">
        <div className="mx-auto flex max-w-[880px] flex-wrap items-center gap-5 px-6 pb-7 pt-10">
          <Avatar initials={initialsOf(email.split("@")[0].replace(/[._-]+/g, " "), "ME")} size="lg" />
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="break-all text-ink-secondary">
              Signed in as <strong className="font-semibold text-ink">{email}</strong>
            </p>
          </div>
        </div>
      </div>
      <main id="main" className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-6 pb-12 pt-7">
        <Card>
          <CardHeader title="Security" />
          <ListRows>
            <ListRow>
              <div className="flex-1">
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-ink-muted">Choose a new password for signing in</p>
              </div>
              <LinkButton variant="outline" size="sm" href="/account/password">
                Change password
              </LinkButton>
            </ListRow>
            <ListRow>
              <div className="flex-1">
                <p className="text-sm font-medium">Sign out</p>
                <p className="text-xs text-ink-muted">Signs you out on this device</p>
              </div>
              <form action={signOutAction}>
                <button type="submit" className={buttonVariants({ variant: "outlineDanger", size: "sm" })}>
                  <LogOut aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </ListRow>
          </ListRows>
        </Card>
      </main>
    </>
  );
}
