import "server-only";

import type { UserRole } from "@/lib/auth/roles";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

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
    .select("id, full_name, phone, clinic_note")
    .eq("id", doctorId)
    .eq("role", "doctor")
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the doctor profile.");
  }
  if (!data) {
    return null;
  }

  const doctor = await supabaseDirectoryRepository.getDoctor(doctorId);
  const department =
    doctor?.departmentId && doctor.departmentName
      ? { id: doctor.departmentId, name: doctor.departmentName }
      : null;

  return {
    id: data.id,
    fullName: data.full_name,
    specialty: formatSpecialties(doctor?.specialties ?? []),
    phone: data.phone,
    clinicNote: data.clinic_note,
    department,
  };
}

/**
 * Other active doctors in the same department, for the sidebar "core team"
 * list. Read-only directory data (name + specialty), never patient data.
 */
export async function listDepartmentColleagues(input: {
  departmentId: string;
  excludeProfileId: string;
}): Promise<DepartmentColleague[]> {
  const colleagues = await supabaseDirectoryRepository.listDoctors({
    departmentId: input.departmentId,
    activeOnly: true,
  });
  return colleagues
    .filter((colleague) => colleague.id !== input.excludeProfileId)
    .slice(0, 12)
    .map((colleague) => ({
      id: colleague.id,
      fullName: colleague.fullName,
      specialty: formatSpecialties(colleague.specialties),
    }));
}

function formatSpecialties(specialties: { name: string }[]): string | null {
  return specialties.length > 0
    ? specialties.map((specialty) => specialty.name).join(", ")
    : null;
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
