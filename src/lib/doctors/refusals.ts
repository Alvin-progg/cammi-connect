/** Codes raised by the 0017 doctor functions, with their messages. */
export const DOCTOR_REFUSALS = [
  "not_admin",
  "not_found",
  "unchanged",
  "full_name_required",
  "department_required",
  "inactive_department",
  "specialty_required",
  "inactive_specialty",
  "not_linkable",
  "not_doctor_account",
  "already_linked",
  "account_has_history",
  "has_future_appointments",
] as const;

export type DoctorRefusal = (typeof DOCTOR_REFUSALS)[number];

export const DOCTOR_REFUSAL_MESSAGES: Record<DoctorRefusal, string> = {
  not_admin: "Only an active administrator can manage doctors.",
  not_found: "That doctor no longer exists.",
  unchanged: "Nothing to change.",
  full_name_required: "Enter the doctor's full name.",
  department_required: "Choose a department.",
  inactive_department: "Choose an active department.",
  specialty_required: "Choose at least one specialty.",
  inactive_specialty: "Choose active specialties only.",
  not_linkable:
    "That account cannot be linked. Choose an active doctor account that is not linked to a doctor yet.",
  not_doctor_account: "Only a doctor account can be linked to a doctor.",
  already_linked: "This doctor already has a linked account.",
  account_has_history:
    "That account already has its own appointments or activity, so it cannot be linked to this doctor.",
  has_future_appointments:
    "This doctor has upcoming appointments. The front desk must reschedule or cancel them before the doctor can be deactivated.",
};

export function doctorRefusalFromCode(code: string | undefined | null): DoctorRefusal | null {
  return DOCTOR_REFUSALS.find((refusal) => refusal === code) ?? null;
}
