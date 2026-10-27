export const USER_ROLES = ["patient", "doctor", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];
