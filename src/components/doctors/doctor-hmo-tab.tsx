import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ListRow, ListRows } from "@/components/ui/data";
import { DoctorAccreditationForm } from "@/components/doctors/doctor-accreditation-form";
import { ACCREDITATION_LABELS } from "@/lib/benefits/labels";
import { formatManilaDate } from "@/lib/appointments/format";
import { readDoctorAccreditations } from "@/server/benefits/repository";

const TONE = { active: "success", pending: "warning", inactive: "neutral", expired: "neutral", rejected: "danger" } as const;

/**
 * Which HMO providers this doctor accepts (spec §5). Rendered only inside the
 * admin doctor page, whose page guard runs getAdminSession first.
 */
export async function DoctorHmoTab({ doctorId }: { doctorId: string }) {
  const { accreditations, providers } = await readDoctorAccreditations(doctorId);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="HMO accreditation" />
        {accreditations.length === 0 ? (
          <EmptyState title="No HMO accreditation" description="This doctor is not accredited with any HMO yet." />
        ) : (
          <ListRows>
            {accreditations.map((accreditation) => (
              <ListRow key={accreditation.id}>
                <div className="flex flex-1 flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-ink">{accreditation.providerName}</span>
                  <Badge tone={TONE[accreditation.status]}>{ACCREDITATION_LABELS[accreditation.status]}</Badge>
                  <span className="text-ink-muted">
                    {formatManilaDate(accreditation.validFrom)}
                    {accreditation.validUntil ? ` to ${formatManilaDate(accreditation.validUntil)}` : " onward"}
                  </span>
                </div>
              </ListRow>
            ))}
          </ListRows>
        )}
      </Card>
      <Card>
        <CardHeader title="Add or update accreditation" />
        <div className="p-5">
          <DoctorAccreditationForm doctorId={doctorId} providers={providers} />
        </div>
      </Card>
    </div>
  );
}
