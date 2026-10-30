"use server";

import { revalidatePath } from "next/cache";

import {
  departmentSchema,
  directoryRecordIdSchema,
  doctorSchema,
  specialtySchema,
} from "@/lib/directory/schemas";
import { getAdminSession } from "@/server/auth/dal";

import { supabaseDirectoryRepository } from "./repository";
import {
  saveDepartment,
  saveDoctor,
  saveSpecialty,
  type DirectoryResult,
} from "./service";

export type DirectoryActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const NOT_AUTHORIZED: DirectoryActionState = {
  status: "error",
  message: "You are not authorized to manage the hospital directory.",
};

function firstIssueMessage(error: {
  issues: { message: string }[];
}): string {
  return error.issues[0]?.message ?? "Check the form values.";
}

/** Optional record id for updates; a blank field means "create". */
function readRecordId(
  formData: FormData,
  field: string,
): { id: string | null } | { error: DirectoryActionState } {
  const raw = formData.get(field);
  if (!raw) {
    return { id: null };
  }
  const parsed = directoryRecordIdSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: { status: "error", message: firstIssueMessage(parsed.error) } };
  }
  return { id: parsed.data };
}

function toActionState(
  result: DirectoryResult,
  successMessage: string,
): DirectoryActionState {
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/admin");
  revalidatePath("/doctor");
  return { status: "success", message: successMessage };
}

export async function saveDepartmentAction(
  _previous: DirectoryActionState,
  formData: FormData,
): Promise<DirectoryActionState> {
  if (!(await getAdminSession("/admin"))) {
    return NOT_AUTHORIZED;
  }
  const record = readRecordId(formData, "departmentId");
  if ("error" in record) {
    return record.error;
  }
  const parsed = departmentSchema.safeParse({
    name: formData.get("name") ?? "",
    code: formData.get("code") ?? "",
    description: formData.get("description"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  return toActionState(
    await saveDepartment({ id: record.id, ...parsed.data }, supabaseDirectoryRepository),
    "Department saved.",
  );
}

export async function saveSpecialtyAction(
  _previous: DirectoryActionState,
  formData: FormData,
): Promise<DirectoryActionState> {
  if (!(await getAdminSession("/admin"))) {
    return NOT_AUTHORIZED;
  }
  const record = readRecordId(formData, "specialtyId");
  if ("error" in record) {
    return record.error;
  }
  const parsed = specialtySchema.safeParse({
    name: formData.get("name") ?? "",
    description: formData.get("description"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  return toActionState(
    await saveSpecialty({ id: record.id, ...parsed.data }, supabaseDirectoryRepository),
    "Specialty saved.",
  );
}

export async function saveDoctorAction(
  _previous: DirectoryActionState,
  formData: FormData,
): Promise<DirectoryActionState> {
  if (!(await getAdminSession("/admin"))) {
    return NOT_AUTHORIZED;
  }
  const record = readRecordId(formData, "doctorId");
  if ("error" in record) {
    return record.error;
  }
  const parsed = doctorSchema.safeParse({
    profileId: formData.get("profileId"),
    fullName: formData.get("fullName") ?? "",
    departmentId: formData.get("departmentId"),
    specialtyIds: formData.getAll("specialtyIds"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  return toActionState(
    await saveDoctor({ doctorId: record.id, ...parsed.data }, supabaseDirectoryRepository),
    "Doctor saved.",
  );
}
