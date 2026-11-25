"use server";

import { revalidatePath, updateTag } from "next/cache";

import { updateDoctorProfileSchema, updatePatientProfileSchema } from "@/lib/profiles/schemas";
import { getDoctorSession, getPatientSession } from "@/server/auth/dal";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";

import { updateDoctorContact, updatePatientProfile } from "./service";

export type ProfileActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export async function updateDoctorProfileAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await getDoctorSession("/doctor");
  if (!session) {
    return {
      status: "error",
      message: "You are not authorized to update this profile.",
    };
  }

  const parsed = updateDoctorProfileSchema.safeParse({
    phone: formData.get("phone"),
    clinicNote: formData.get("clinicNote"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Check the profile details.",
    };
  }

  await updateDoctorContact({
    doctorId: session.doctor.id,
    phone: parsed.data.phone,
    clinicNote: parsed.data.clinicNote,
  });
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/doctor", "layout");
  return { status: "success", message: "Profile updated." };
}

export async function updatePatientProfileAction(
  _previous: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await getPatientSession("/account");
  if (!session) {
    return { status: "error", message: "You are not authorized to update this profile." };
  }

  const parsed = updatePatientProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check your profile details.",
    };
  }

  await updatePatientProfile({
    patientId: session.patient.id,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
  });
  revalidatePath("/account");
  revalidatePath("/chat", "layout");
  return { status: "success", message: "Profile saved." };
}
