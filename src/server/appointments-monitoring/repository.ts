import "server-only";

import type { MonitoringListItem } from "@/lib/appointments/monitoring";
import type { AppointmentStatus, BookingSource } from "@/lib/appointments/status";
import { getSupabaseAdminClient } from "@/server/db/admin-client";
import { loadDepartmentNames } from "@/server/directory/repository";
import {
  supabaseFrontDeskRequestsRepository,
  toSearchTerm,
} from "@/server/front-desk/repository";

import type { AppointmentMonitoringReader } from "./service";

const MONITORING_SELECT =
  "id, patient_id, doctor_id, specialty_id, scheduled_at, duration_minutes, status, booking_source, created_by_profile_id, confirmed_by_profile_id, confirmed_at";

/**
 * A name search matching more patients than this only filters by the first
 * ones, alphabetically; the admin narrows the name. It keeps the `in` filter
 * inside PostgREST's URL limits.
 */
const PATIENT_MATCH_LIMIT = 500;

type MonitoringRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  specialty_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  booking_source: BookingSource;
  created_by_profile_id: string | null;
  confirmed_by_profile_id: string | null;
  confirmed_at: string | null;
};

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))];
}

async function loadNames(
  table: "profiles" | "specialties",
  column: "full_name" | "name",
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) {
    return new Map();
  }
  const { data, error } = await getSupabaseAdminClient()
    .from(table)
    .select(`id, ${column}`)
    .in("id", ids)
    .overrideTypes<Record<string, string>[], { merge: false }>();
  if (error) {
    throw new Error("Unable to load appointment details.");
  }
  return new Map((data ?? []).map((row) => [row.id, row[column]?.trim() ?? ""]));
}

async function loadDoctorDepartmentIds(doctorIds: string[]): Promise<Map<string, string>> {
  if (doctorIds.length === 0) {
    return new Map();
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("doctors")
    .select("id, department_id")
    .in("id", doctorIds);
  if (error) {
    throw new Error("Unable to load appointment departments.");
  }
  return new Map(
    (data ?? []).flatMap((row) => (row.department_id ? [[row.id, row.department_id] as const] : [])),
  );
}

/** Resolves people, department, and specialty names. Patient contact details are not selected. */
async function toListItems(rows: MonitoringRow[]): Promise<MonitoringListItem[]> {
  const [people, specialties, doctorDepartments] = await Promise.all([
    loadNames(
      "profiles",
      "full_name",
      unique(
        rows.flatMap((row) => [
          row.patient_id,
          row.doctor_id,
          row.created_by_profile_id,
          row.confirmed_by_profile_id,
        ]),
      ),
    ),
    loadNames("specialties", "name", unique(rows.map((row) => row.specialty_id))),
    loadDoctorDepartmentIds(unique(rows.map((row) => row.doctor_id))),
  ]);
  const departments = await loadDepartmentNames(unique([...doctorDepartments.values()]));

  const nameOf = (id: string | null) => (id ? people.get(id) || null : null);

  return rows.map((row) => {
    const departmentId = doctorDepartments.get(row.doctor_id);
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: nameOf(row.patient_id) ?? "Unknown patient",
      doctorName: nameOf(row.doctor_id) ?? "Doctor",
      departmentName: departmentId ? (departments.get(departmentId) ?? null) : null,
      specialtyName: row.specialty_id ? (specialties.get(row.specialty_id) ?? null) : null,
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      status: row.status,
      bookingSource: row.booking_source,
      createdByName: nameOf(row.created_by_profile_id),
      confirmedByName: nameOf(row.confirmed_by_profile_id),
    } satisfies MonitoringListItem;
  });
}

/** Ids of patients whose name contains `search`, or null when the search is empty after cleaning. */
async function findPatientIds(search: string): Promise<string[] | null> {
  const term = toSearchTerm(search);
  if (!term) {
    return null;
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("id")
    .eq("role", "patient")
    .ilike("full_name", `%${term}%`)
    .order("full_name", { ascending: true })
    .limit(PATIENT_MATCH_LIMIT);
  if (error) {
    throw new Error("Unable to search patients.");
  }
  return (data ?? []).map((row) => row.id);
}

async function findDepartmentDoctorIds(departmentId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("doctors")
    .select("id")
    .eq("department_id", departmentId);
  if (error) {
    throw new Error("Unable to load department doctors.");
  }
  return (data ?? []).map((row) => row.id);
}

/**
 * System-wide appointment reads for the admin monitoring pages (ADM-09).
 * Read-only: this module never writes. Authorization is the caller's
 * `getAdminSession()` check; the service-role client bypasses RLS.
 */
export const supabaseAppointmentMonitoringRepository: AppointmentMonitoringReader = {
  async listAppointments({ search, doctorId, departmentId, statuses, source, start, end, limit, offset }) {
    const [patientIds, departmentDoctorIds] = await Promise.all([
      search ? findPatientIds(search) : null,
      departmentId ? findDepartmentDoctorIds(departmentId) : null,
    ]);
    if (patientIds?.length === 0 || departmentDoctorIds?.length === 0) {
      return { items: [], total: 0 };
    }

    let query = getSupabaseAdminClient()
      .from("appointments")
      .select(MONITORING_SELECT, { count: "exact" });
    if (patientIds) query = query.in("patient_id", patientIds);
    if (departmentDoctorIds) query = query.in("doctor_id", departmentDoctorIds);
    if (doctorId) query = query.eq("doctor_id", doctorId);
    if (statuses.length > 0) query = query.in("status", statuses);
    if (source) query = query.eq("booking_source", source);
    if (start) query = query.gte("scheduled_at", start);
    if (end) query = query.lt("scheduled_at", end);

    const { data, error, count } = await query
      .order("scheduled_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) {
      throw new Error("Unable to load appointments.");
    }
    return { items: await toListItems(data ?? []), total: count ?? 0 };
  },

  async getAppointment(appointmentId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("appointments")
      .select(`${MONITORING_SELECT}, created_at`)
      .eq("id", appointmentId)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the appointment.");
    }
    if (!data) {
      return null;
    }

    // The front desk read model already resolves contact details, reasons,
    // and the audit timeline; reuse it instead of a second copy.
    const [[item], request] = await Promise.all([
      toListItems([data]),
      supabaseFrontDeskRequestsRepository.getRequest(appointmentId),
    ]);
    if (!item || !request) {
      return null;
    }
    return {
      ...item,
      patientEmail: request.patientEmail,
      patientPhone: request.patientPhone,
      createdAt: data.created_at,
      confirmedAt: data.confirmed_at,
      reason: request.reason,
      rejectionReason: request.rejectionReason,
      cancellationReason: request.cancellationReason,
      history: request.history,
    };
  },
};
