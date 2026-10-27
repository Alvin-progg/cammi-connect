import "server-only";

import { headers } from "next/headers";

import { createSupabaseServerClient } from "./client";

export type SignInInput = { email: string; password: string };
export type SignUpPatientInput = {
  fullName: string;
  email: string;
  password: string;
  next: string;
};

export type ServiceError = { ok: false; code: string | undefined };
export type SignInResult = { ok: true; userId: string } | ServiceError;
export type SignUpPatientResult =
  | { ok: true; sessionCreated: boolean }
  | ServiceError;

export type SessionUser = { id: string; email: string };

export async function signIn(input: SignInInput): Promise<SignInResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(input);
  if (error || !data.user) {
    return { ok: false, code: error?.code ?? undefined };
  }
  return { ok: true, userId: data.user.id };
}

async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    throw new Error("Unable to determine the request origin for the email redirect.");
  }
  return `${protocol}://${host}`;
}

export async function signUpPatient(
  input: SignUpPatientInput,
): Promise<SignUpPatientResult> {
  const supabase = await createSupabaseServerClient();
  const origin = await getRequestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(input.next)}`,
    },
  });
  if (error) {
    return { ok: false, code: error.code ?? undefined };
  }
  // A session is only returned when email confirmation is disabled.
  return { ok: true, sessionCreated: Boolean(data.session) };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  try {
    await supabase.auth.signOut();
  } catch {
    // Best effort: if the provider call fails, the session cookies are still
    // cleared on the next authenticated refresh cycle.
  }
}

/**
 * Server-side identity check via the Auth server. Never trust `getSession()`
 * for authorization; `getUser()` revalidates against Supabase.
 */
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return { id: data.user.id, email: data.user.email ?? "" };
}
