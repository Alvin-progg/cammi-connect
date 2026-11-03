import type { DepartmentStatRow, DepartmentStatusCounts } from "./types";

/** Appointments per department, all statuses together. */
export function totalsByDepartment(rows: DepartmentStatRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.departmentId, (totals.get(row.departmentId) ?? 0) + row.count);
  }
  return totals;
}

/** One department's appointment counts by status. */
export function countsByStatus(
  rows: DepartmentStatRow[],
  departmentId: string,
): DepartmentStatusCounts {
  const counts: DepartmentStatusCounts = {};
  for (const row of rows) {
    if (row.departmentId === departmentId) {
      counts[row.status] = (counts[row.status] ?? 0) + row.count;
    }
  }
  return counts;
}
