import "server-only";

import type {
  AdminDoctorListItem,
  DoctorAppointmentRow,
  DoctorConflict,
} from "@/lib/doctors/types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import { loadDepartmentNames, loadDoctorSpecialties } from "@/server/directory/repository";

import type { DoctorAdminStore } from "./service";

/** P0001 refusals carry their code as the message; anything else is unexpected. */
function refusalCode(error: { code?: string; message: string }): string | undefined {
  if (error.code === "P0001") {
    return error.message;
  }
  console.error("Admin doctor database call failed.");
  return undefined;
}

type DoctorRow = {
  id: string;
  full_name: string;
  department_id: string | null;
  is_active: boolean;
};

/** Adds department names, specialties, and whether each doctor has a login. */
async function toListItems(rows: DoctorRow[]): Promise<AdminDoctorListItem[]> {
  if (rows.length === 0) {
    return [];
  }
  const doctorIds = rows.map((row) => row.id);
  const departmentIds = [
    ...new Set(rows.flatMap((row) => (row.department_id ? [row.department_id] : []))),
  ];

  const [specialtiesByDoctor, departmentNames, logins] = await Promise.all([
    loadDoctorSpecialties(doctorIds),
    loadDepartmentNames(departmentIds),
    getSupabaseAdminClient().from("profiles").select("id, auth_user_id").in("id", doctorIds),
  ]);
  if (logins.error) {
    throw new Error("Unable to load doctor accounts.");
  }
  const withLogin = new Set(
    (logins.data ?? []).filter((profile) => profile.auth_user_id !== null).map((profile) => profile.id),
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    departmentId: row.department_id,
    departmentName: row.department_id ? (departmentNames.get(row.department_id) ?? null) : null,
    isActive: row.is_active,
    specialties: specialtiesByDoctor.get(row.id) ?? [],
    hasLogin: withLogin.has(row.id),
  }));
}

export const supabaseDoctorAdminRepository: DoctorAdminStore = {
  async listDoctors({ departmentId, specialtyId, status }) {
    const supabase = getSupabaseAdminClient();

    let doctorIdsForSpecialty: string[] | null = null;
    if (specialtyId) {
      const { data, error } = await supabase
        .from("doctor_specialties")
        .select("doctor_id")
        .eq("specialty_id", specialtyId);
      if (error) {
        throw new Error("Unable to load doctors.");
      }
      doctorIdsForSpecialty = (data ?? []).map((row) => row.doctor_id);
      if (doctorIdsForSpecialty.length === 0) {
        return [];
      }
    }

    let query = supabase.from("doctors").select("id, full_name, department_id, is_active");
    if (departmentId) query = query.eq("department_id", departmentId);
    if (status !== "all") query = query.eq("is_active", status === "active");
    if (doctorIdsForSpecialty) query = query.in("id", doctorIdsForSpecialty);

    const { data, error } = await query.order("full_name", { ascending: true }).limit(200);
    if (error) {
      throw new Error("Unable to load doctors.");
    }
    return toListItems(data ?? []);
  },

  async getDoctor(doctorId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("doctors")
      .select("id, full_name, department_id, is_active, contact_email, contact_phone, bio")
      .eq("id", doctorId)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the doctor.");
    }
    if (!data) {
      return null;
    }
    const [doctor] = await toListItems([data]);
    return {
      ...doctor,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      bio: data.bio,
    };
  },

  async listLinkableAccounts() {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_list_linkable_doctor_accounts",
    );
    if (error) {
      throw new Error("Unable to load doctor accounts.");
    }
    return (data ?? []).map((row) => ({ profileId: row.profile_id, fullName: row.full_name }));
  },

  async isLinkableAccount(profileId) {
    const supabase = getSupabaseAdminClient();
    const [account, doctorRecord] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .eq("id", profileId)
        .eq("role", "doctor")
        .eq("is_active", true)
        .not("auth_user_id", "is", null)
        .maybeSingle(),
      supabase.from("doctors").select("id").eq("id", profileId).maybeSingle(),
    ]);
    if (account.error || doctorRecord.error) {
      throw new Error("Unable to check the doctor account.");
    }
    return account.data !== null && doctorRecord.data === null;
  },

  async listFutureConflicts(doctorId) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_doctor_future_conflicts",
      { p_doctor_id: doctorId },
    );
    if (error) {
      throw new Error("Unable to check the doctor's upcoming appointments.");
    }
    return (data ?? []).map(
      (row): DoctorConflict => ({
        appointmentId: row.appointment_id,
        scheduledAt: row.scheduled_at,
        status: row.status,
      }),
    );
  },

  /** The latest 100 appointments, newest first. Patient data is not selected. */
  async listAppointmentHistory(doctorId) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status, specialty_id")
      .eq("doctor_id", doctorId)
      .order("scheduled_at", { ascending: false })
      .limit(100);
    if (error) {
      throw new Error("Unable to load the doctor's appointments.");
    }
    const rows = data ?? [];

    const specialtyIds = [
      ...new Set(rows.flatMap((row) => (row.specialty_id ? [row.specialty_id] : []))),
    ];
    const specialtyNames = new Map<string, string>();
    if (specialtyIds.length > 0) {
      const specialties = await supabase.from("specialties").select("id, name").in("id", specialtyIds);
      if (specialties.error) {
        throw new Error("Unable to load the doctor's appointments.");
      }
      for (const specialty of specialties.data ?? []) {
        specialtyNames.set(specialty.id, specialty.name);
      }
    }

    return rows.map(
      (row): DoctorAppointmentRow => ({
        appointmentId: row.id,
        scheduledAt: row.scheduled_at,
        status: row.status,
        specialtyName: row.specialty_id ? (specialtyNames.get(row.specialty_id) ?? null) : null,
      }),
    );
  },

  async save({
    actorId,
    doctorId,
    accountProfileId,
    fullName,
    departmentId,
    contactEmail,
    contactPhone,
    bio,
    specialtyIds,
  }) {
    const { data, error } = await getSupabaseAdminClient().rpc("cammi_connect_admin_save_doctor", {
      p_actor_profile_id: actorId,
      p_doctor_id: doctorId,
      p_account_profile_id: accountProfileId,
      p_full_name: fullName,
      p_department_id: departmentId,
      p_contact_email: contactEmail,
      p_contact_phone: contactPhone,
      p_bio: bio,
      p_specialty_ids: specialtyIds,
    });
    if (error || !data) {
      return { ok: false, code: error ? refusalCode(error) : undefined };
    }
    return { ok: true, doctorId: data };
  },

  async linkAccount({ actorId, doctorId, accountProfileId }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_link_doctor_account",
      {
        p_actor_profile_id: actorId,
        p_doctor_id: doctorId,
        p_account_profile_id: accountProfileId,
      },
    );
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },

  async setActive({ actorId, doctorId, isActive }) {
    const { error } = await getSupabaseAdminClient().rpc("cammi_connect_admin_set_doctor_active", {
      p_actor_profile_id: actorId,
      p_doctor_id: doctorId,
      p_is_active: isActive,
    });
    return error ? { ok: false, code: refusalCode(error) } : { ok: true };
  },
};
