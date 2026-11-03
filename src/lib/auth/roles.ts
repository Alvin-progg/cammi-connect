export const USER_ROLES = ["patient", "doctor", "admin", "front_desk"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Administrator",
  front_desk: "Front desk",
};
