import "server-only";

import type { AppointmentStatus } from "@/lib/appointments/status";
import type {
  AppointmentHistoryEntry,
  DoctorAppointment,
} from "@/lib/appointments/types";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { AppointmentBooker, DoctorAppointmentsReader } from "./service";

type AppointmentRow = {
  id: string;
  patient_id: string;
  reason: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
};

type PatientRow = {
  id: string;
  full_name: string;
};

const APPOINTMENT_SELECT =
  "id, patient_id, reason, scheduled_at, duration_minutes, status";

async function mapRowsToAppointments(
  rows: AppointmentRow[],
): Promise<DoctorAppointment[]> {
  if (rows.length === 0) {
    return [];
  }
  const supabase = getSupabaseAdminClient();
  const patientIds = [...new Set(rows.map((row) => row.patient_id))];
  const { data: patientRows, error: patientError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", patientIds);

  if (patientError) {
    throw new Error("Unable to load patient names.");
  }

  const patientNames = new Map<string, string>(
    ((patientRows ?? []) as PatientRow[]).map((patient) => [
      patient.id,
      patient.full_name,
    ]),
  );

  return rows.map((row) => {
    const patientName = patientNames.get(row.patient_id);
    if (!patientName) {
      throw new Error("Unable to resolve a patient name.");
    }
    return {
      id: row.id,
      patientName,
      reason: row.reason?.trim() || null,
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      status: row.status,
    } satisfies DoctorAppointment;
  });
}

/**
 * Reads the minimum fields needed to render the doctor dashboard. `patient_id`
 * is used only to join patient names inside this module; it never leaves the
 * repository in the UI DTO. Patient contact details and clinical records are
 * not selected.
 */
export const supabaseDoctorAppointmentsRepository: DoctorAppointmentsReader = {
  async listForDoctor({ doctorId, start, end, status }) {
    const supabase = getSupabaseAdminClient();

    const baseQuery = supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("doctor_id", doctorId)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end);

    const filteredQuery = status ? baseQuery.eq("status", status) : baseQuery;
    const { data, error } = await filteredQuery
      .order("scheduled_at", { ascending: true })
      .limit(200);

    if (error) {
      throw new Error("Unable to load appointments.");
    }
    return mapRowsToAppointments((data ?? []) as AppointmentRow[]);
  },

  async countForDoctor({ doctorId, start, end }) {
    const supabase = getSupabaseAdminClient();
    const { count, error } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .gte("scheduled_at", start)
      .lt("scheduled_at", end);

    if (error) {
      throw new Error("Unable to count appointments.");
    }
    return count ?? 0;
  },

  async getForDoctor({ doctorId, appointmentId }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("doctor_id", doctorId)
      .eq("id", appointmentId)
      .maybeSingle();

    if (error) {
      throw new Error("Unable to load the appointment.");
    }
    if (!data) {
      return null;
    }
    const [appointment] = await mapRowsToAppointments([
      data as AppointmentRow,
    ]);
    return appointment ?? null;
  },

  async listActiveIntervals({ doctorId, start, end, excludeId }) {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("appointments")
      .select("id, scheduled_at, duration_minutes")
      .eq("doctor_id", doctorId)
      .in("status", ["requested", "confirmed"])
      .gte("scheduled_at", start)
      .lt("scheduled_at", end);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error("Unable to check overlapping appointments.");
    }
    return ((data ?? []) as {
      scheduled_at: string;
      duration_minutes: number;
    }[]).map((row) => ({
      start: row.scheduled_at,
      end: new Date(
        new Date(row.scheduled_at).getTime() +
          row.duration_minutes * 60 * 1000,
      ).toISOString(),
    }));
  },

  async applyTransition({ appointmentId, from, to, cancellationReason }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("appointments")
      .update(
        to === "cancelled"
          ? {
              status: to,
              cancellation_reason: cancellationReason,
              cancelled_by_role: "doctor",
            }
          : { status: to },
      )
      .eq("id", appointmentId)
      .in("status", [...from])
      .select("id");

    if (error) {
      throw new Error("Unable to update the appointment status.");
    }
    return (data ?? []).length > 0;
  },

  async reschedule({ appointmentId, scheduledAt, rescheduledFromAt }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({
        scheduled_at: scheduledAt,
        rescheduled_from_at: rescheduledFromAt,
      })
      .eq("id", appointmentId)
      .in("status", ["requested", "confirmed"])
      .select("id");

    if (error) {
      throw new Error("Unable to reschedule the appointment.");
    }
    return (data ?? []).length > 0;
  },

  async insertHistory({
    appointmentId,
    fromStatus,
    toStatus,
    changedByProfileId,
    reason,
    scheduledAtSnapshot,
  }) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("appointment_status_history").insert({
      appointment_id: appointmentId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by_profile_id: changedByProfileId,
      reason,
      scheduled_at_snapshot: scheduledAtSnapshot,
    });

    if (error) {
      throw new Error("Unable to record the appointment history entry.");
    }
  },

  async listHistory({ appointmentIds }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("appointment_status_history")
      .select(
        "id, appointment_id, from_status, to_status, reason, scheduled_at_snapshot, created_at",
      )
      .in("appointment_id", appointmentIds)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      throw new Error("Unable to load appointment history.");
    }
    return (data ?? []).map(
      (row): AppointmentHistoryEntry => ({
        id: row.id,
        appointmentId: row.appointment_id,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        reason: row.reason,
        scheduledAtSnapshot: row.scheduled_at_snapshot,
        createdAt: row.created_at,
      }),
    );
  },
};

/**
 * Calls the cammi_connect_book_appointment database function, which locks the
 * doctor, re-checks availability, and inserts the appointment and its history
 * row in one transaction.
 */
export const supabaseAppointmentBooker: AppointmentBooker = {
  async book({ doctorId, patientId, scheduledAt, reason }) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("cammi_connect_book_appointment", {
      p_doctor_id: doctorId,
      p_patient_id: patientId,
      p_scheduled_at: scheduledAt,
      p_reason: reason,
    });

    if (error) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    return { ok: true, appointmentId: data };
  },
};
