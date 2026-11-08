export const USER_ROLES = ["patient", "doctor", "admin", "front_desk"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  patient: "Patient",
  doctor: "Doctor",
  admin: "Administrator",
  front_desk: "Front desk",
};

/** Each role's home page after sign-in, or when a signed-in user opens /login. */
export const ROLE_LANDING_PATHS: Record<UserRole, string> = {
  doctor: "/doctor",
  admin: "/admin",
  patient: "/chat",
  front_desk: "/front-desk",
};
