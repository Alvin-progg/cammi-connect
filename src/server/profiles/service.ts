import "server-only";

import type { UserRole } from "@/lib/auth/roles";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

export type Profile = {
  id: string;
  role: UserRole;
  fullName: string;
};

export type DoctorProfileDetails = {
  id: string;
  fullName: string;
  specialty: string | null;
  phone: string | null;
  clinicNote: string | null;
  department: { id: string; name: string } | null;
};

export type DepartmentColleague = {
  id: string;
  fullName: string;
  specialty: string | null;
};

export async function getProfileForAuthUser(
  authUserId: string,
): Promise<Profile | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the signed-in profile.");
  }
  if (!data) {
    return null;
  }

  return {
    id: data.id,
    role: data.role,
    fullName: data.full_name,
  };
}

/** Hospital-managed fields plus the doctor's permitted contact details. */
export async function getDoctorProfileDetails(
  doctorId: string,
): Promise<DoctorProfileDetails | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, specialty, phone, clinic_note, department_id")
    .eq("id", doctorId)
    .eq("role", "doctor")
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the doctor profile.");
  }
  if (!data) {
    return null;
  }

  let department: DoctorProfileDetails["department"] = null;
  if (data.department_id) {
    const { data: departmentRow, error: departmentError } = await supabase
      .from("departments")
      .select("id, name")
      .eq("id", data.department_id)
      .maybeSingle();
    if (departmentError) {
      throw new Error("Unable to load the assigned department.");
    }
    department = departmentRow
      ? { id: departmentRow.id, name: departmentRow.name }
      : null;
  }

  return {
    id: data.id,
    fullName: data.full_name,
    specialty: data.specialty,
    phone: data.phone,
    clinicNote: data.clinic_note,
    department,
  };
}

/**
 * Other doctors in the same department, for the sidebar "core team" list.
 * Read-only directory data (name + specialty), never patient data.
 */
export async function listDepartmentColleagues(input: {
  departmentId: string;
  excludeProfileId: string;
}): Promise<DepartmentColleague[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, specialty")
    .eq("department_id", input.departmentId)
    .eq("role", "doctor")
    .neq("id", input.excludeProfileId)
    .order("full_name", { ascending: true })
    .limit(12);

  if (error) {
    throw new Error("Unable to load department colleagues.");
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    specialty: row.specialty,
  }));
}

export async function updateDoctorContact(input: {
  doctorId: string;
  phone: string;
  clinicNote: string;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      phone: input.phone || null,
      clinic_note: input.clinicNote || null,
    })
    .eq("id", input.doctorId)
    .eq("role", "doctor");

  if (error) {
    throw new Error("Unable to update the doctor profile.");
  }
}
