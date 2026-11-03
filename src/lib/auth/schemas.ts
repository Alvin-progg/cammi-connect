import { z } from "zod";

/** Shared with the registration form's password hint so the two never drift. */
export const PASSWORD_MIN_LENGTH = 6;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(72, "Password is too long.");

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(100, "Full name is too long."),
    email: z.email("Enter a valid email address."),
    password: newPassword,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

/** Setting a password from an invite or reset link. */
export const setPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

/**
 * The email links an admin can trigger: a staff invite and a password reset.
 * Their templates point at /auth/confirm (db/README.md).
 */
export const emailLinkSchema = z.object({
  tokenHash: z.string().min(1),
  type: z.enum(["invite", "recovery"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
