export const USER_ROLES = ["patient", "doctor", "admin", "front_desk"] as const;

export type UserRole = (typeof USER_ROLES)[number];
