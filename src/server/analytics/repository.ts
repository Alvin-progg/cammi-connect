import "server-only";

import type { AppointmentStatus } from "@/lib/appointments/status";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { DashboardReader, PendingSummary } from "./service";

/** PostgREST returns at most this many rows per request by default. */
const PAGE_SIZE = 1000;
/** Ids per `in` filter, keeping the request URL well inside PostgREST's limits. */
const ID_CHUNK_SIZE = 200;

type AnalyticsRow = {
  id: string;
  doctor_id: string;
  scheduled_at: string;
  scheduled_end_at: string;
  status: AppointmentStatus;
  confirmed_at: string | null;
};

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/** Doctor ids in the department, or null when no department filter is set. */
async function findDepartmentDoctorIds(departmentId: string | null): Promise<string[] | null> {
  if (!departmentId) {
    return null;
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("doctors")
    .select("id")
    .eq("department_id", departmentId);
  if (error) {
    throw new Error("Unable to load department doctors.");
  }
  return (data ?? []).map((row) => row.id);
}

async function loadPeriodRows(query: {
  start: string;
  end: string;
  doctorId: string | null;
  departmentDoctorIds: string[] | null;
}): Promise<AnalyticsRow[]> {
  const rows: AnalyticsRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let request = getSupabaseAdminClient()
      .from("appointments")
      .select("id, doctor_id, scheduled_at, scheduled_end_at, status, confirmed_at")
      .gte("scheduled_at", query.start)
      .lt("scheduled_at", query.end);
    if (query.doctorId) request = request.eq("doctor_id", query.doctorId);
    if (query.departmentDoctorIds) request = request.in("doctor_id", query.departmentDoctorIds);

    const { data, error } = await request
      .order("scheduled_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error("Unable to load analytics appointments.");
    }
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) {
      return rows;
    }
  }
}

/** Appointment ids with a `confirmed` audit row, and the time of each `cancelled` audit row. */
async function loadAuditEvidence(appointmentIds: string[]) {
  const confirmed = new Set<string>();
  const cancelledAt = new Map<string, string>();

  for (const ids of chunk(appointmentIds, ID_CHUNK_SIZE)) {
    const { data, error } = await getSupabaseAdminClient()
      .from("appointment_audit_logs")
      .select("appointment_id, new_status, created_at")
      .in("appointment_id", ids)
      .in("new_status", ["confirmed", "cancelled"])
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error("Unable to load appointment history.");
    }
    for (const row of data ?? []) {
      if (row.new_status === "confirmed") {
        confirmed.add(row.appointment_id);
      } else {
        // Ascending order: the latest cancellation wins.
        cancelledAt.set(row.appointment_id, row.created_at);
      }
    }
  }
  return { confirmed, cancelledAt };
}

async function loadProfileNames(profileIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const ids of chunk(profileIds, ID_CHUNK_SIZE)) {
    const { data, error } = await getSupabaseAdminClient().from("profiles").select("id, full_name").in("id", ids);
    if (error) {
      throw new Error("Unable to load names.");
    }
    for (const row of data ?? []) {
      names.set(row.id, row.full_name.trim());
    }
  }
  return names;
}

/** Distinct appointment ids with a `cancelled` audit row created in `[start, end)`. */
async function loadCancelledIdsBetween(start: string, end: string): Promise<string[]> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await getSupabaseAdminClient()
      .from("appointment_audit_logs")
      .select("appointment_id")
      .eq("new_status", "cancelled")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error("Unable to load cancellations.");
    }
    for (const row of data ?? []) ids.add(row.appointment_id);
    if ((data ?? []).length < PAGE_SIZE) {
      return [...ids];
    }
  }
}

/** Every `requested` appointment, narrowed by doctor and department. */
async function loadPendingRows(doctorId: string | null, departmentDoctorIds: string[] | null) {
  const rows: { doctor_id: string; created_at: string }[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let request = getSupabaseAdminClient()
      .from("appointments")
      .select("id, doctor_id, created_at")
      .eq("status", "requested");
    if (doctorId) request = request.eq("doctor_id", doctorId);
    if (departmentDoctorIds) request = request.in("doctor_id", departmentDoctorIds);

    const { data, error } = await request
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      throw new Error("Unable to load pending requests.");
    }
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) {
      return rows;
    }
  }
}

/** Department name per doctor id; doctors without a department are left out. */
async function loadDoctorDepartmentNames(doctorIds: string[]): Promise<Map<string, string>> {
  const departmentIdByDoctor = new Map<string, string>();
  for (const ids of chunk(doctorIds, ID_CHUNK_SIZE)) {
    const { data, error } = await getSupabaseAdminClient().from("doctors").select("id, department_id").in("id", ids);
    if (error) {
      throw new Error("Unable to load doctor departments.");
    }
    for (const row of data ?? []) {
      if (row.department_id) departmentIdByDoctor.set(row.id, row.department_id);
    }
  }

  const departmentIds = [...new Set(departmentIdByDoctor.values())];
  const departmentNames = new Map<string, string>();
  for (const ids of chunk(departmentIds, ID_CHUNK_SIZE)) {
    const { data, error } = await getSupabaseAdminClient().from("departments").select("id, name").in("id", ids);
    if (error) {
      throw new Error("Unable to load departments.");
    }
    for (const row of data ?? []) departmentNames.set(row.id, row.name);
  }

  const names = new Map<string, string>();
  for (const [doctorId, departmentId] of departmentIdByDoctor) {
    const name = departmentNames.get(departmentId);
    if (name) names.set(doctorId, name);
  }
  return names;
}

const NO_DEPARTMENT = "No department";

/**
 * System-wide appointment reads for analytics (ADM-10). Read-only, and no
 * patient identifiers are selected. Authorization is the caller's
 * `getAdminSession()` check; the service-role client bypasses RLS.
 */
export const supabaseAnalyticsRepository: DashboardReader = {
  async listAppointments({ start, end, doctorId, departmentId }) {
    const departmentDoctorIds = await findDepartmentDoctorIds(departmentId);
    if (departmentDoctorIds?.length === 0) {
      return [];
    }

    const rows = await loadPeriodRows({ start, end, doctorId, departmentDoctorIds });
    const [evidence, doctorNames] = await Promise.all([
      loadAuditEvidence(rows.map((row) => row.id)),
      loadProfileNames([...new Set(rows.map((row) => row.doctor_id))]),
    ]);

    return rows.map((row) => ({
      id: row.id,
      doctorId: row.doctor_id,
      doctorName: doctorNames.get(row.doctor_id) || "Doctor",
      scheduledAt: row.scheduled_at,
      scheduledEndAt: row.scheduled_end_at,
      status: row.status,
      confirmedAt: row.confirmed_at,
      confirmedInAudit: evidence.confirmed.has(row.id),
      cancelledAt: evidence.cancelledAt.get(row.id) ?? null,
    }));
  },

  async countPending({ doctorId, departmentId }) {
    const departmentDoctorIds = await findDepartmentDoctorIds(departmentId);
    if (departmentDoctorIds?.length === 0) {
      return 0;
    }

    let request = getSupabaseAdminClient()
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "requested");
    if (doctorId) request = request.eq("doctor_id", doctorId);
    if (departmentDoctorIds) request = request.in("doctor_id", departmentDoctorIds);

    const { count, error } = await request;
    if (error) {
      throw new Error("Unable to count pending requests.");
    }
    return count ?? 0;
  },

  async countCancelledBetween({ start, end, doctorId, departmentId }) {
    const departmentDoctorIds = await findDepartmentDoctorIds(departmentId);
    if (departmentDoctorIds?.length === 0) {
      return 0;
    }

    // Cancellation is terminal, so an appointment has at most one cancelled row
    // and "latest cancellation in range" is "a cancellation in range".
    let total = 0;
    for (const ids of chunk(await loadCancelledIdsBetween(start, end), ID_CHUNK_SIZE)) {
      let request = getSupabaseAdminClient()
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .in("id", ids)
        .eq("status", "cancelled");
      if (doctorId) request = request.eq("doctor_id", doctorId);
      if (departmentDoctorIds) request = request.in("doctor_id", departmentDoctorIds);

      const { count, error } = await request;
      if (error) {
        throw new Error("Unable to count cancellations.");
      }
      total += count ?? 0;
    }
    return total;
  },

  async pendingSummary({ doctorId, departmentId }): Promise<PendingSummary> {
    const departmentDoctorIds = await findDepartmentDoctorIds(departmentId);
    if (departmentDoctorIds?.length === 0) {
      return { count: 0, oldestCreatedAt: null, byDepartment: [] };
    }

    const rows = await loadPendingRows(doctorId, departmentDoctorIds);
    const departmentNames = await loadDoctorDepartmentNames([...new Set(rows.map((row) => row.doctor_id))]);
    const counts = new Map<string, number>();
    for (const row of rows) {
      const name = departmentNames.get(row.doctor_id) ?? NO_DEPARTMENT;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return {
      count: rows.length,
      // Rows are ordered by created_at ascending.
      oldestCreatedAt: rows[0]?.created_at ?? null,
      byDepartment: [...counts]
        .map(([departmentName, count]) => ({ departmentName, count }))
        .sort((a, b) => b.count - a.count || a.departmentName.localeCompare(b.departmentName)),
    };
  },

  async listRecentAppointmentActivity(limit) {
    const { data, error } = await getSupabaseAdminClient()
      .from("appointment_audit_logs")
      .select("id, appointment_id, actor_profile_id, action, previous_status, new_status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error("Unable to load appointment activity.");
    }
    const rows = data ?? [];
    const actorIds = rows.flatMap((row) => (row.actor_profile_id ? [row.actor_profile_id] : []));
    const actors = await loadProfileNames([...new Set(actorIds)]);
    return rows.map((row) => ({
      id: row.id,
      appointmentId: row.appointment_id,
      action: row.action,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      actorName: (row.actor_profile_id && actors.get(row.actor_profile_id)) || null,
      createdAt: row.created_at,
    }));
  },

  async listRecentAdminActivity(limit) {
    const { data, error } = await getSupabaseAdminClient()
      .from("audit_logs")
      .select("id, actor_profile_id, action, target_type, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error("Unable to load system activity.");
    }
    const rows = data ?? [];
    const actors = await loadProfileNames([...new Set(rows.map((row) => row.actor_profile_id))]);
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.target_type,
      actorName: actors.get(row.actor_profile_id) || null,
      createdAt: row.created_at,
    }));
  },
};
