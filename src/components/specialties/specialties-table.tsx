import Link from "next/link";

import { ActiveBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/data";
import { CELL, HEADER_CELL, ROW, Table } from "@/components/ui/data";
import type { SpecialtyOverview } from "@/lib/specialties/types";

export function SpecialtiesTable({ specialties }: { specialties: SpecialtyOverview[] }) {
  if (specialties.length === 0) {
    return <EmptyState>No specialties yet.</EmptyState>;
  }

  return (
    <Table label="Specialties" minWidthClass="min-w-[32rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Name</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
          <th scope="col" className={HEADER_CELL}>Doctors</th>
        </tr>
      </thead>
      <tbody>
        {specialties.map((specialty) => (
          <tr key={specialty.id} className={ROW}>
            <td className={CELL}>
              <Link
                href={`/admin/specialties/${specialty.id}`}
                className="rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
              >
                {specialty.name}
              </Link>
            </td>
            <td className={CELL}>
              <ActiveBadge isActive={specialty.isActive} />
            </td>
            <td className={`${CELL} tabular-nums`}>{specialty.doctorCount}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
