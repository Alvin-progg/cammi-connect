"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { doctorFormSchema } from "@/lib/doctors/schemas";
import type { DoctorConflict } from "@/lib/doctors/types";
import { getAdminSession } from "@/server/auth/dal";

import { supabaseDoctorAdminRepository } from "./repository";
import { linkDoctorAccount, saveDoctor, setDoctorActive } from "./service";

export type DoctorActionState =
  | { status: "idle" }
  | { status: "error"; message: string; conflicts?: DoctorConflict[] }
  | { status: "success"; message: string };

const DOCTORS_PATH = "/admin/doctors";

const NOT_AUTHORIZED: DoctorActionState = {
  status: "error",
  message: "You are not authorized to manage doctors.",
};

const INVALID_DOCTOR: DoctorActionState = {
  status: "error",
  message: "That doctor is not valid.",
};

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function firstIssueMessage(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Check the form values.";
}

/** The acting admin's profile ID, always from the session and never from the form. */
async function requireAdminActor(): Promise<string | null> {
  const session = await getAdminSession(DOCTORS_PATH);
  return session?.admin.id ?? null;
}

/** Department/specialty pages list doctors, and doctors see their own profile. */
function refreshAfterDoctorChange() {
  revalidatePath("/admin", "layout");
  revalidatePath("/doctor");
}

export async function saveDoctorAction(
  _previous: DoctorActionState,
  formData: FormData,
): Promise<DoctorActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const rawId = text(formData, "doctorId")?.trim() || null;
  const doctorId = rawId === null ? null : z.uuid().safeParse(rawId).data;
  if (doctorId === undefined) {
    return INVALID_DOCTOR;
  }
  const parsed = doctorFormSchema.safeParse({
    fullName: text(formData, "fullName") ?? "",
    departmentId: text(formData, "departmentId") ?? "",
    specialtyIds: formData.getAll("specialtyIds"),
    contactEmail: text(formData, "contactEmail"),
    contactPhone: text(formData, "contactPhone"),
    bio: text(formData, "bio"),
    accountProfileId: text(formData, "accountProfileId"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const result = await saveDoctor(
    { actorId, doctorId, input: parsed.data },
    supabaseDoctorAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  refreshAfterDoctorChange();
  if (doctorId === null) {
    redirect(`${DOCTORS_PATH}/${result.doctorId}`);
  }
  return { status: "success", message: result.message };
}

export async function linkDoctorAccountAction(
  _previous: DoctorActionState,
  formData: FormData,
): Promise<DoctorActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const doctorId = z.uuid().safeParse(text(formData, "doctorId"));
  const accountProfileId = z.uuid().safeParse(text(formData, "accountProfileId"));
  if (!doctorId.success || !accountProfileId.success) {
    return INVALID_DOCTOR;
  }

  const result = await linkDoctorAccount(
    { actorId, doctorId: doctorId.data, accountProfileId: accountProfileId.data },
    supabaseDoctorAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  refreshAfterDoctorChange();
  return { status: "success", message: result.message };
}

export async function setDoctorActiveAction(
  _previous: DoctorActionState,
  formData: FormData,
): Promise<DoctorActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const doctorId = z.uuid().safeParse(text(formData, "doctorId"));
  const isActive = z.stringbool().safeParse(text(formData, "isActive"));
  if (!doctorId.success || !isActive.success) {
    return INVALID_DOCTOR;
  }

  const result = await setDoctorActive(
    { actorId, doctorId: doctorId.data, isActive: isActive.data },
    supabaseDoctorAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message, conflicts: result.conflicts };
  }
  refreshAfterDoctorChange();
  return { status: "success", message: result.message };
}
