import Link from "next/link";

import { ActiveBadge } from "@/components/admin/active-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { CELL, HEADER_CELL, ROW, TableFrame } from "@/components/front-desk/table-frame";
import type { AdminDoctorListItem } from "@/lib/doctors/types";

export function DoctorsTable({ doctors }: { doctors: AdminDoctorListItem[] }) {
  if (doctors.length === 0) {
    return <EmptyState>No doctors match these filters.</EmptyState>;
  }

  return (
    <TableFrame label="Doctors" minWidthClass="min-w-[48rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Name</th>
          <th scope="col" className={HEADER_CELL}>Department</th>
          <th scope="col" className={HEADER_CELL}>Specialties</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
          <th scope="col" className={HEADER_CELL}>Sign-in</th>
        </tr>
      </thead>
      <tbody>
        {doctors.map((doctor) => (
          <tr key={doctor.id} className={ROW}>
            <td className={CELL}>
              <Link
                href={`/admin/doctors/${doctor.id}`}
                className="rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
              >
                {doctor.fullName}
              </Link>
            </td>
            <td className={CELL}>{doctor.departmentName ?? "—"}</td>
            <td className={CELL}>
              <ul aria-label="Specialties" className="flex flex-wrap gap-1.5">
                {doctor.specialties.map((specialty) => (
                  <li
                    key={specialty.id}
                    className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-secondary"
                  >
                    {specialty.name}
                  </li>
                ))}
              </ul>
            </td>
            <td className={CELL}>
              <ActiveBadge isActive={doctor.isActive} />
            </td>
            <td className={`${CELL} text-ink-secondary`}>{doctor.hasLogin ? "Linked" : "No login"}</td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
