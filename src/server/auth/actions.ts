"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { messageForAuthError } from "@/lib/auth/errors";
import type { AuthFormState, FieldErrors } from "@/lib/auth/form-state";
import {
  AUTH_NOTICE_PARAM,
  AUTH_NOTICE_SIGNED_IN,
} from "@/lib/auth/notice";
import { sanitizeReturnPath } from "@/lib/auth/return-path";
import type { UserRole } from "@/lib/auth/roles";
import { loginSchema, registerSchema } from "@/lib/auth/schemas";
import { getProfileForAuthUser } from "@/server/profiles/service";

import { signIn, signOut, signUpPatient } from "./service";

const DEFAULT_AUTH_REDIRECT = "/account";

const ROLE_LANDING_PATHS: Record<UserRole, string> = {
  doctor: "/doctor",
  admin: DEFAULT_AUTH_REDIRECT, // No admin dashboard route yet.
  patient: DEFAULT_AUTH_REDIRECT,
};

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function withAuthNotice(path: string): string {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(AUTH_NOTICE_PARAM, AUTH_NOTICE_SIGNED_IN);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Role-aware landing for a sign-in without a specific return path. Lookup
 * failures fall back to the generic account page so a database problem cannot
 * block an otherwise successful sign-in.
 */
async function defaultLandingPath(userId: string): Promise<string> {
  try {
    const profile = await getProfileForAuthUser(userId);
    return profile ? ROLE_LANDING_PATHS[profile.role] : DEFAULT_AUTH_REDIRECT;
  } catch {
    console.error("Unable to resolve the post-login landing path.");
    return DEFAULT_AUTH_REDIRECT;
  }
}

function toFieldErrors(
  flattened: { fieldErrors: Record<string, string[] | undefined> },
): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
    if (messages?.length) {
      fieldErrors[key as keyof FieldErrors] = messages;
    }
  }
  return fieldErrors;
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(z.flattenError(parsed.error)) };
  }

  const result = await signIn(parsed.data);
  if (!result.ok) {
    return { formError: messageForAuthError(result.code) };
  }

  const requestedNext = sanitizeReturnPath(readString(formData.get("next")));
  const next =
    requestedNext && requestedNext !== DEFAULT_AUTH_REDIRECT
      ? requestedNext
      : await defaultLandingPath(result.userId);
  redirect(withAuthNotice(next));
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(z.flattenError(parsed.error)) };
  }

  const { fullName, email, password } = parsed.data;
  const next =
    sanitizeReturnPath(readString(formData.get("next"))) || DEFAULT_AUTH_REDIRECT;

  const result = await signUpPatient({ fullName, email, password, next });
  if (!result.ok) {
    return { formError: messageForAuthError(result.code) };
  }
  if (result.sessionCreated) {
    redirect(next);
  }
  return {
    success: "If an account can be created for this email, check your inbox.",
  };
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}
