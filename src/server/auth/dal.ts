import "server-only";

import { redirect } from "next/navigation";

import { getUser, type SessionUser } from "./service";

/**
 * Authorization check enforced in the data layer. The proxy performs an
 * optimistic redirect only; even if it is bypassed, unauthenticated visitors
 * are redirected here.
 */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }
  return user;
}
