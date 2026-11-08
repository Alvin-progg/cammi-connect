"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { departmentFormSchema } from "@/lib/departments/schemas";
import type { DepartmentConflict } from "@/lib/departments/types";
import { getAdminSession } from "@/server/auth/dal";
import { REFERENCE_CACHE_TAG } from "@/server/cache/reference-tag";

import { supabaseDepartmentAdminRepository } from "./repository";
import { saveDepartment, setDepartmentActive } from "./service";

export type DepartmentActionState =
  | { status: "idle" }
  | { status: "error"; message: string; conflicts?: DepartmentConflict[] }
  | { status: "success"; message: string };

const DEPARTMENTS_PATH = "/admin/departments";

const NOT_AUTHORIZED: DepartmentActionState = {
  status: "error",
  message: "You are not authorized to manage departments.",
};

const INVALID_DEPARTMENT: DepartmentActionState = {
  status: "error",
  message: "That department is not valid.",
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
  const session = await getAdminSession(DEPARTMENTS_PATH);
  return session?.admin.id ?? null;
}

/** Doctors, chat, and the other admin pages show department names and status. */
function refreshAdmin() {
  updateTag(REFERENCE_CACHE_TAG);
  revalidatePath("/admin", "layout");
}

export async function saveDepartmentAction(
  _previous: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }

  const rawId = text(formData, "departmentId")?.trim() || null;
  const departmentId = rawId === null ? null : z.uuid().safeParse(rawId).data;
  if (departmentId === undefined) {
    return INVALID_DEPARTMENT;
  }
  const parsed = departmentFormSchema.safeParse({
    name: text(formData, "name") ?? "",
    code: text(formData, "code") ?? "",
    description: text(formData, "description"),
  });
  if (!parsed.success) {
    return { status: "error", message: firstIssueMessage(parsed.error) };
  }

  const result = await saveDepartment(
    { actorId, departmentId, input: parsed.data },
    supabaseDepartmentAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  refreshAdmin();
  if (departmentId === null) {
    redirect(`${DEPARTMENTS_PATH}/${result.departmentId}`);
  }
  return { status: "success", message: result.message };
}

export async function setDepartmentActiveAction(
  _previous: DepartmentActionState,
  formData: FormData,
): Promise<DepartmentActionState> {
  const actorId = await requireAdminActor();
  if (!actorId) {
    return NOT_AUTHORIZED;
  }
  const departmentId = z.uuid().safeParse(text(formData, "departmentId"));
  const isActive = z.stringbool().safeParse(text(formData, "isActive"));
  if (!departmentId.success || !isActive.success) {
    return INVALID_DEPARTMENT;
  }

  const result = await setDepartmentActive(
    { actorId, departmentId: departmentId.data, isActive: isActive.data },
    supabaseDepartmentAdminRepository,
  );
  if (!result.ok) {
    return { status: "error", message: result.message, conflicts: result.conflicts };
  }
  refreshAdmin();
  return { status: "success", message: result.message };
}
