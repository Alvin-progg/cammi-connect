import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Suspense } from "react";

import { LinkButton, buttonVariants } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand-mark";
import { Avatar, Card, CardHeader } from "@/components/ui/card";
import { ListRow, ListRows } from "@/components/ui/data";
import { PatientProfileForm } from "@/components/account/patient-profile-form";
import { VerifiedBenefitBadges } from "@/components/benefits/verified-benefit-badges";
import { initialsOf } from "@/components/ui/rail";
import { getPatientSession, requireUser } from "@/server/auth/dal";
import { signOutAction } from "@/server/auth/actions";
import { readPatientBenefits } from "@/server/benefits/repository";
import { getPatientProfileDetails } from "@/server/profiles/service";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-8">
        <span className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
          <BrandMark className="size-7" />
          CamiConnect
        </span>
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
  const patient = await getPatientSession("/account");
  const [profile, benefits] = patient
    ? await Promise.all([
        getPatientProfileDetails(patient.patient.id),
        readPatientBenefits(patient.patient.id),
      ])
    : [null, null];
  const pwdVerified = benefits?.pwd?.verificationStatus === "verified";
  const hmoVerified = benefits?.hmo.some((membership) => membership.verificationStatus === "verified") ?? false;
  const avatarInitials = patient
    ? initialsOf(patient.patient.fullName, "ME")
    : initialsOf(email.split("@")[0].replace(/[._-]+/g, " "), "ME");

  return (
    <>
      <div className="border-b border-line bg-wash">
        <div className="mx-auto flex max-w-[880px] flex-wrap items-center gap-5 px-6 pb-7 pt-10">
          <Avatar initials={avatarInitials} size="lg" />
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight">Your account</h1>
            <p className="break-all text-ink-secondary">
              Signed in as <strong className="font-semibold text-ink">{email}</strong>
            </p>
          </div>
        </div>
      </div>
      <main id="main" className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-6 pb-12 pt-7">
        {patient ? (
          <div>
            <LinkButton variant="outline" size="sm" href="/chat">
              Back to chat
            </LinkButton>
          </div>
        ) : null}
        {patient && profile ? (
          <Card>
            <CardHeader title="Profile" />
            <PatientProfileForm initialFullName={profile.fullName} initialPhone={profile.phone ?? ""} />
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Security" />
          <ListRows>
            <ListRow>
              <div className="flex-1">
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-ink-muted">Choose a new password for signing in</p>
              </div>
              <LinkButton variant="outline" size="sm" href="/account/password?from=account">
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
        {patient ? (
          <Card>
            <CardHeader title="Benefits" />
            <div className="px-4 pt-4">
              <VerifiedBenefitBadges pwdVerified={pwdVerified} hmoVerified={hmoVerified} />
            </div>
            <ListRows>
              <ListRow>
                <div className="flex-1">
                  <p className="text-sm font-medium">PWD and HMO</p>
                  <p className="text-xs text-ink-muted">Declare PWD status and add HMO membership</p>
                </div>
                <LinkButton variant="outline" size="sm" href="/account/benefits">
                  Manage benefits
                </LinkButton>
              </ListRow>
            </ListRows>
          </Card>
        ) : null}
      </main>
    </>
  );
}
