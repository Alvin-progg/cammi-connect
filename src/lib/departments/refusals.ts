/** Codes raised by the 0015 department functions, with their messages. */
export const DEPARTMENT_REFUSALS = [
  "not_admin",
  "duplicate",
  "not_found",
  "unchanged",
  "has_future_appointments",
] as const;

export type DepartmentRefusal = (typeof DEPARTMENT_REFUSALS)[number];

export const DEPARTMENT_REFUSAL_MESSAGES: Record<DepartmentRefusal, string> = {
  not_admin: "Only an active administrator can manage departments.",
  duplicate: "A department with that name or code already exists.",
  not_found: "That department no longer exists.",
  unchanged: "Nothing to change.",
  has_future_appointments:
    "This department has upcoming appointments. The front desk must reschedule or cancel them before it can be deactivated.",
};

export function departmentRefusalFromCode(
  code: string | undefined | null,
): DepartmentRefusal | null {
  return DEPARTMENT_REFUSALS.find((refusal) => refusal === code) ?? null;
}
