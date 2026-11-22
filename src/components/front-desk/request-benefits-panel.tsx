import { AppointmentHmoForm } from "@/components/benefits/appointment-hmo-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import {
  ACCREDITATION_LABELS,
  AUTHORIZATION_LABELS,
  COVERAGE_LABELS,
} from "@/lib/benefits/labels";
import { formatManilaDate } from "@/lib/appointments/format";
import { readRequestBenefits } from "@/server/benefits/repository";

/**
 * Benefits on one request (spec §7.3). The full membership number is shown
 * here only: front desk staff verifying coverage need it. Authorization and
 * coverage are edited independently, and an accreditation never implies coverage.
 */
export async function RequestBenefitsPanel({ appointmentId }: { appointmentId: string }) {
  const benefits = await readRequestBenefits(appointmentId);
  if (!benefits) return null;
  const { hmo } = benefits;

  return (
    <Card>
      <CardHeader title="Benefits" />
      <div className="flex flex-col gap-4 p-5 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-ink-muted">PWD</span>
          <Badge tone={benefits.pwdVerified ? "success" : "neutral"}>
            {benefits.pwdVerified ? "Verified" : "Not verified"}
          </Badge>
        </div>
        {hmo ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-ink-muted">Provider</dt>
              <dd className="text-ink">{hmo.providerName}</dd>
              <dt className="text-ink-muted">Membership</dt>
              <dd className="font-mono text-ink">{hmo.membershipNumber}</dd>
              <dt className="text-ink-muted">Doctor accreditation</dt>
              <dd className="text-ink">
                {hmo.accreditationStatus ? ACCREDITATION_LABELS[hmo.accreditationStatus] : "Not recorded"}
                {hmo.accreditationValidFrom
                  ? ` · from ${formatManilaDate(hmo.accreditationValidFrom)}${hmo.accreditationValidUntil ? ` to ${formatManilaDate(hmo.accreditationValidUntil)}` : ""}`
                  : ""}
              </dd>
              <dt className="text-ink-muted">Authorization</dt>
              <dd className="text-ink">{AUTHORIZATION_LABELS[hmo.authorization]}</dd>
              <dt className="text-ink-muted">Coverage</dt>
              <dd className="text-ink">{COVERAGE_LABELS[hmo.coverage]}</dd>
              <dt className="text-ink-muted">LOA</dt>
              <dd className="text-ink">{hmo.loaNumber ?? "None recorded"}</dd>
            </dl>
            <AppointmentHmoForm
              key={`${hmo.authorization}-${hmo.coverage}-${hmo.loaNumber ?? ""}-${hmo.remarks ?? ""}`}
              appointmentId={appointmentId}
              authorization={hmo.authorization}
              coverage={hmo.coverage}
              loaNumber={hmo.loaNumber}
              remarks={hmo.remarks}
            />
          </>
        ) : (
          <p className="text-ink-muted">No HMO on this appointment.</p>
        )}
      </div>
    </Card>
  );
}
