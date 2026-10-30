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

export type AdminSession = {
  user: SessionUser;
  admin: {
    id: string;
    fullName: string;
  };
};

/**
 * Resolves the signed-in admin profile. Every admin page and Server Action
 * calls this before touching directory or schedule data; a null result must
 * be treated as access denied.
 */
export async function getAdminSession(
  returnTo: string,
): Promise<AdminSession | null> {
  const user = await requireUser(returnTo);
  const profile = await getProfileForAuthUser(user.id);

  if (!profile || profile.role !== "admin") {
    return null;
  }

  return {
    user,
    admin: {
      id: profile.id,
      fullName: profile.fullName.trim() || "Administrator",
    },
  };
}

export type PatientSession = {
  user: SessionUser;
  patient: {
    id: string;
    fullName: string;
  };
};

/**
 * Resolves the signed-in patient profile. Booking passes only this profile ID
 * as the patient, so a patient cannot book on behalf of someone else.
 */
export async function getPatientSession(
  returnTo: string,
): Promise<PatientSession | null> {
  const user = await requireUser(returnTo);
  const profile = await getProfileForAuthUser(user.id);

  if (!profile || profile.role !== "patient") {
    return null;
  }

  return {
    user,
    patient: {
      id: profile.id,
      fullName: profile.fullName.trim() || "Patient",
    },
  };
}
