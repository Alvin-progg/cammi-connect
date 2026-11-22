import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/auth/access-denied";
import { HmoForm, PwdForm } from "@/components/benefits/patient-benefit-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ListRow, ListRows } from "@/components/ui/data";
import { maskMemberNumber } from "@/lib/billing/hmo";
import { VERIFICATION_LABELS } from "@/lib/benefits/labels";
import { getPatientSession } from "@/server/auth/dal";
import { readPatientBenefits } from "@/server/benefits/repository";
import { listActiveHmoProviderOptions } from "@/server/benefits/providers";

export const metadata: Metadata = { title: "Your benefits" };

const PATH = "/account/benefits";
const TONE = { pending: "warning", verified: "success", rejected: "danger", expired: "neutral" } as const;

export default async function AccountBenefitsPage() {
  const session = await getPatientSession(PATH);
  if (!session) {
    return <AccessDenied message="Benefits are only available to patient accounts." />;
  }

  const [benefits, providers] = await Promise.all([
    readPatientBenefits(session.patient.id),
    listActiveHmoProviderOptions(),
  ]);
  const pwdLabel = benefits.pwd ? "Send new PWD details" : "Send PWD details";
  const hmoLabel = "Add HMO membership";

  return (
    <main id="main" className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <Link href="/account" className="text-sm text-ink-muted hover:text-ink">← Back to account</Link>
        <h1 className="text-3xl font-semibold tracking-tight">Your benefits</h1>
        <p className="text-ink-secondary">
          A PWD discount or HMO coverage applies to a booking only after the front desk has verified it.
          Changing a verified ID or membership sends it back for review.
        </p>
      </div>

      <Card>
        <CardHeader title="PWD" />
        {benefits.pwd ? (
          <div className="flex flex-col gap-2 p-5 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone={TONE[benefits.pwd.verificationStatus]}>
                {VERIFICATION_LABELS[benefits.pwd.verificationStatus]}
              </Badge>
              <span className="font-mono text-ink">{maskMemberNumber(benefits.pwd.idNumber)}</span>
            </div>
            {benefits.pwd.rejectionReason ? (
              <p className="text-danger">Reason: {benefits.pwd.rejectionReason}</p>
            ) : null}
          </div>
        ) : (
          <p className="p-5 text-sm text-ink-muted">You have not declared PWD status.</p>
        )}
        <div className="border-t border-line p-5">
          <PwdForm submitLabel={pwdLabel} />
        </div>
      </Card>

      <Card>
        <CardHeader title="HMO memberships" />
        {benefits.hmo.length === 0 ? (
          <p className="p-5 text-sm text-ink-muted">No HMO membership added.</p>
        ) : (
          <ListRows>
            {benefits.hmo.map((membership) => (
              <ListRow key={membership.id}>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{membership.providerName}</span>
                    <Badge tone={TONE[membership.verificationStatus]}>
                      {VERIFICATION_LABELS[membership.verificationStatus]}
                    </Badge>
                  </div>
                  <span className="font-mono text-ink-muted">{maskMemberNumber(membership.membershipNumber)}</span>
                  {membership.rejectionReason ? (
                    <span className="text-danger">Reason: {membership.rejectionReason}</span>
                  ) : null}
                </div>
              </ListRow>
            ))}
          </ListRows>
        )}
        <div className="border-t border-line p-5">
          <p className="mb-4 text-xs text-ink-muted">
            Accreditation is set per doctor. Cami will tell you if a doctor does not accept your HMO.
          </p>
          <HmoForm providers={providers} submitLabel={hmoLabel} />
        </div>
      </Card>
    </main>
  );
}
