import "server-only";

import { redirect } from "next/navigation";

import { getProfileForAuthUser } from "@/server/profiles/service";

import { getUser, type SessionUser } from "./service";

export type DoctorSession = {
  user: SessionUser;
  doctor: {
    id: string;
    fullName: string;
  };
};

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

/**
 * Resolves the signed-in doctor profile. Anonymous visitors are redirected to
 * sign in; signed-in users without the doctor role get a neutral denied state
 * from the page. The page passes only this profile ID to the appointment
 * service, so the query scope cannot be widened through the URL.
 */
export async function getDoctorSession(
  returnTo: string,
): Promise<DoctorSession | null> {
  const user = await requireUser(returnTo);
  const profile = await getProfileForAuthUser(user.id);

  if (!profile || profile.role !== "doctor") {
    return null;
  }

  return {
    user,
    doctor: {
      id: profile.id,
      fullName: profile.fullName.trim() || "Doctor",
    },
  };
}
