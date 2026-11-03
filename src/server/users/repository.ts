import "server-only";

import type { AdminUserRow, UserActivityEntry } from "@/lib/users/types";
import type { Database } from "@/server/db/database.types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { DatabaseOutcome, ManagedUser, UserAdminStore } from "./service";

type Functions = Database["public"]["Functions"];
type ListUsersRow = Functions["cammi_connect_admin_list_users"]["Returns"][number];
type GetUserRow = Functions["cammi_connect_admin_get_user"]["Returns"][number];

/** Effectively permanent; "none" lifts the ban. */
const SIGN_IN_BAN_DURATION = "876000h";

/** Picks the table fields explicitly, so nothing else from the row can leak to the UI. */
export function toAdminUserRow(row: ListUsersRow): AdminUserRow {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
  };
}

export function toManagedUser(row: GetUserRow): ManagedUser {
  return {
    ...toAdminUserRow({ ...row, total_count: 1 }),
    authUserId: row.auth_user_id,
    phone: row.phone,
    hasDoctorRecord: row.has_doctor_record,
  };
}

/** P0001 refusals carry their code as the message; anything else is unexpected. */
function toOutcome(error: { code?: string; message: string } | null): DatabaseOutcome {
  if (!error) {
    return { ok: true };
  }
  if (error.code === "P0001") {
    return { ok: false, code: error.message };
  }
  console.error("Admin user management database call failed.");
  return { ok: false, code: undefined };
}

export const supabaseUserAdminRepository: UserAdminStore = {
  async listUsers({ search, role, isActive, limit, offset }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_list_users",
      {
        p_search: search,
        p_role: role,
        p_is_active: isActive,
        p_limit: limit,
        p_offset: offset,
      },
    );
    if (error) {
      throw new Error("Unable to load accounts.");
    }
    const rows = data ?? [];
    return { users: rows.map(toAdminUserRow), total: Number(rows[0]?.total_count ?? 0) };
  },

  async getUser(profileId) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_get_user",
      { p_profile_id: profileId },
    );
    if (error) {
      throw new Error("Unable to load the account.");
    }
    const row = data?.[0];
    return row ? toManagedUser(row) : null;
  },

  async listActivity(profileId, limit) {
    // profileId is a validated UUID, so it is safe inside the filter string.
    const { data, error } = await getSupabaseAdminClient()
      .from("audit_logs")
      .select("id, action, actor_profile_id, target_type, target_id, reason, created_at")
      .or(
        `actor_profile_id.eq.${profileId},and(target_type.eq.user,target_id.eq.${profileId})`,
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error("Unable to load account activity.");
    }
    return (data ?? []).map(
      (row): UserActivityEntry => ({
        id: row.id,
        action: row.action,
        actorProfileId: row.actor_profile_id,
        targetType: row.target_type,
        targetId: row.target_id,
        reason: row.reason,
        createdAt: row.created_at,
      }),
    );
  },

  async inviteUser({ email, fullName }) {
    const { data, error } = await getSupabaseAdminClient().auth.admin.inviteUserByEmail(
      email,
      { data: { full_name: fullName } },
    );
    if (error || !data.user) {
      return { ok: false, code: error?.code ?? undefined };
    }
    return { ok: true, authUserId: data.user.id };
  },

  async provisionStaff({ actorId, authUserId, role, fullName, phone }) {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_provision_staff",
      {
        p_actor_profile_id: actorId,
        p_auth_user_id: authUserId,
        p_role: role,
        p_full_name: fullName,
        p_phone: phone,
      },
    );
    if (error || !data) {
      const outcome = toOutcome(error);
      return { ok: false, code: outcome.ok ? undefined : outcome.code };
    }
    return { ok: true, profileId: data };
  },

  async setRole({ actorId, profileId, role, reason }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_set_user_role",
      {
        p_actor_profile_id: actorId,
        p_target_profile_id: profileId,
        p_new_role: role,
        p_reason: reason,
      },
    );
    return toOutcome(error);
  },

  async setActive({ actorId, profileId, isActive, reason }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_set_user_active",
      {
        p_actor_profile_id: actorId,
        p_target_profile_id: profileId,
        p_is_active: isActive,
        p_reason: reason,
      },
    );
    return toOutcome(error);
  },

  async updateProfile({ actorId, profileId, fullName, phone }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_admin_update_user_profile",
      {
        p_actor_profile_id: actorId,
        p_target_profile_id: profileId,
        p_full_name: fullName,
        p_phone: phone,
      },
    );
    return toOutcome(error);
  },

  async setSignInBlocked(authUserId, blocked) {
    const { error } = await getSupabaseAdminClient().auth.admin.updateUserById(authUserId, {
      ban_duration: blocked ? SIGN_IN_BAN_DURATION : "none",
    });
    return !error;
  },

  async sendPasswordReset(email) {
    // The email template links to /auth/confirm (db/README.md), so no
    // redirect URL is needed here.
    const { error } = await getSupabaseAdminClient().auth.resetPasswordForEmail(email);
    return !error;
  },
};
