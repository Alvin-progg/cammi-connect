import Link from "next/link";

import { ActiveBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/data";
import type { DoctorSummary } from "@/lib/directory/types";

/** Doctors who have the specialty, with a link to manage them under Doctors. */
export function SpecialtyDoctors({
  specialtyId,
  doctors,
}: {
  specialtyId: string;
  doctors: DoctorSummary[];
}) {
  return (
    <>
      {doctors.length === 0 ? (
        <EmptyState>No doctors have this specialty yet.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {doctors.map((doctor) => (
            <li key={doctor.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-ink">{doctor.fullName}</span>
              <ActiveBadge isActive={doctor.isActive} />
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/admin/doctors?specialty=${specialtyId}`}
        className="self-start rounded text-sm font-medium text-primary underline underline-offset-4 focus-ring"
      >
        Manage doctors
      </Link>
    </>
  );
}
