import { z } from "zod";

export const ADMIN_VIEWS = [
  "doctors",
  "departments",
  "specialties",
  "schedule",
] as const;

export type AdminView = (typeof ADMIN_VIEWS)[number];

export const ADMIN_VIEW_LABELS: Record<AdminView, string> = {
  doctors: "Doctors",
  departments: "Departments",
  specialties: "Specialties",
  schedule: "Schedules",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminView(value: string | string[] | undefined): AdminView {
  const raw = firstValue(value);
  return ADMIN_VIEWS.find((view) => view === raw) ?? "doctors";
}

/** A UUID search param (doctor, department, specialty), or null when absent or malformed. */
export function parseRecordIdParam(
  value: string | string[] | undefined,
): string | null {
  const parsed = z.uuid().safeParse(firstValue(value));
  return parsed.success ? parsed.data : null;
}
