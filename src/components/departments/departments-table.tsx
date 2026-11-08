import Link from "next/link";

import { ActiveBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/data";
import { CELL, HEADER_CELL, ROW, Table } from "@/components/ui/data";
import { DEPARTMENT_STATS_WINDOW_DAYS, type DepartmentOverview } from "@/lib/departments/types";

export function DepartmentsTable({ departments }: { departments: DepartmentOverview[] }) {
  if (departments.length === 0) {
    return <EmptyState>No departments yet.</EmptyState>;
  }

  return (
    <Table label="Departments" minWidthClass="min-w-[44rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Name</th>
          <th scope="col" className={HEADER_CELL}>Code</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
          <th scope="col" className={HEADER_CELL}>Doctors</th>
          <th scope="col" className={HEADER_CELL}>
            {`Appointments (last ${DEPARTMENT_STATS_WINDOW_DAYS} days)`}
          </th>
        </tr>
      </thead>
      <tbody>
        {departments.map((department) => (
          <tr key={department.id} className={ROW}>
            <td className={CELL}>
              <Link
                href={`/admin/departments/${department.id}`}
                className="rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
              >
                {department.name}
              </Link>
            </td>
            <td className={CELL}>{department.code}</td>
            <td className={CELL}>
              <ActiveBadge isActive={department.isActive} />
            </td>
            <td className={`${CELL} tabular-nums`}>{department.doctorCount}</td>
            <td className={`${CELL} tabular-nums`}>{department.recentAppointmentCount}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
