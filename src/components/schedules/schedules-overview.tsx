import Link from "next/link";

import { ActiveBadge } from "@/components/admin/active-badge";
import { EmptyState } from "@/components/admin/empty-state";
import { CELL, HEADER_CELL, ROW, TableFrame } from "@/components/front-desk/table-frame";
import type { DoctorSummary } from "@/lib/directory/types";
import { formatScheduleSummary, type WeeklySchedule } from "@/lib/schedules/types";

/**
 * Every listed doctor's weekly hours in effect today, one row per doctor,
 * linking to that doctor's schedule editor.
 */
export function SchedulesOverview({
  doctors,
  schedules,
  today,
}: {
  doctors: DoctorSummary[];
  schedules: WeeklySchedule[];
  today: string;
}) {
  if (doctors.length === 0) {
    return <EmptyState>No doctors match this filter.</EmptyState>;
  }

  return (
    <TableFrame label="Doctor schedules" minWidthClass="min-w-[40rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Doctor</th>
          <th scope="col" className={HEADER_CELL}>Department</th>
          <th scope="col" className={HEADER_CELL}>Weekly hours</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
        </tr>
      </thead>
      <tbody>
        {doctors.map((doctor) => (
          <tr key={doctor.id} className={ROW}>
            <td className={CELL}>
              <Link
                href={`/admin/schedules?doctor=${doctor.id}`}
                className="rounded font-medium text-primary underline-offset-4 focus-ring hover:text-primary-hover hover:underline"
              >
                {doctor.fullName}
              </Link>
            </td>
            <td className={CELL}>{doctor.departmentName ?? "—"}</td>
            <td className={`${CELL} tabular-nums text-ink-secondary`}>
              {formatScheduleSummary(
                schedules.filter((schedule) => schedule.doctorId === doctor.id),
                today,
              )}
            </td>
            <td className={CELL}>
              <ActiveBadge isActive={doctor.isActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </TableFrame>
  );
}
