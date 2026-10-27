"use server";

import { revalidatePath } from "next/cache";

import { updateDoctorProfileSchema } from "@/lib/profiles/schemas";
import { getDoctorSession } from "@/server/auth/dal";

import { updateDoctorContact } from "./service";

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
  revalidatePath("/doctor");
  return { status: "success", message: "Profile updated." };
}
