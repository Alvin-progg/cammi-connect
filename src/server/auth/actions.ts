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
import { loginSchema, registerSchema } from "@/lib/auth/schemas";

import { signIn, signOut, signUpPatient } from "./service";

const DEFAULT_AUTH_REDIRECT = "/account";

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function withAuthNotice(path: string): string {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(AUTH_NOTICE_PARAM, AUTH_NOTICE_SIGNED_IN);
  return `${url.pathname}${url.search}${url.hash}`;
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

  const next =
    sanitizeReturnPath(readString(formData.get("next"))) || DEFAULT_AUTH_REDIRECT;
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
