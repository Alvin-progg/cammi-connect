import "server-only";

import type { AppointmentStatus } from "@/lib/appointments/status";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { AnalyticsReader } from "./service";

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

async function loadDoctorNames(doctorIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const ids of chunk(doctorIds, ID_CHUNK_SIZE)) {
    const { data, error } = await getSupabaseAdminClient().from("profiles").select("id, full_name").in("id", ids);
    if (error) {
      throw new Error("Unable to load doctor names.");
    }
    for (const row of data ?? []) {
      names.set(row.id, row.full_name.trim());
    }
  }
  return names;
}

/**
 * System-wide appointment reads for analytics (ADM-10). Read-only, and no
 * patient identifiers are selected. Authorization is the caller's
 * `getAdminSession()` check; the service-role client bypasses RLS.
 */
export const supabaseAnalyticsRepository: AnalyticsReader = {
  async listAppointments({ start, end, doctorId, departmentId }) {
    const departmentDoctorIds = await findDepartmentDoctorIds(departmentId);
    if (departmentDoctorIds?.length === 0) {
      return [];
    }

    const rows = await loadPeriodRows({ start, end, doctorId, departmentDoctorIds });
    const [evidence, doctorNames] = await Promise.all([
      loadAuditEvidence(rows.map((row) => row.id)),
      loadDoctorNames([...new Set(rows.map((row) => row.doctor_id))]),
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
};
