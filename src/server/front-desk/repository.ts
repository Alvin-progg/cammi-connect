import "server-only";

import { scheduledAtFromAuditValues } from "@/lib/appointments/audit";
import type {
  AppointmentStatus,
  BookingSource,
} from "@/lib/appointments/status";
import type { UserRole } from "@/lib/auth/roles";
import type {
  RequestAuditEntry,
  RequestDetails,
  RequestQueueItem,
} from "@/lib/front-desk/requests";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { FrontDeskRequestsReader, FrontDeskRequestsWriter } from "./service";

const REQUEST_SELECT =
  "id, patient_id, doctor_id, specialty_id, scheduled_at, duration_minutes, created_at, status, booking_source, reason, rejection_reason, cancellation_reason";

type RequestRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  specialty_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  created_at: string;
  status: AppointmentStatus;
  booking_source: BookingSource;
  reason: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
};

type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  role: UserRole;
  full_name: string;
  phone: string | null;
};

/** Cami-submitted requests only (SPEC-frontdesk §5). */
const AI_BOOKING_SOURCE: BookingSource = "ai_chatbot";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

async function loadProfiles(ids: string[]): Promise<Map<string, ProfileRow>> {
  if (ids.length === 0) {
    return new Map();
  }
  const { data, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("id, auth_user_id, role, full_name, phone")
    .in("id", ids);
  if (error) {
    throw new Error("Unable to load appointment people.");
  }
  return new Map((data ?? []).map((profile) => [profile.id, profile]));
}

/**
 * Sign-in emails live in Supabase Auth, not in profiles. Each lookup goes
 * through the service-role Auth admin API. A failed lookup reads as "not
 * provided" so one missing account does not hide the whole queue.
 */
async function loadEmails(authUserIds: string[]): Promise<Map<string, string>> {
  const supabase = getSupabaseAdminClient();
  const entries = await Promise.all(
    authUserIds.map(async (authUserId) => {
      const { data, error } = await supabase.auth.admin.getUserById(authUserId);
      const email = error ? undefined : data.user?.email;
      return email ? ([authUserId, email] as const) : null;
    }),
  );
  return new Map(entries.filter((entry) => entry !== null));
}

/**
 * The specialty to show for each request: the recorded one when the booking
 * captured it, otherwise every specialty the doctor offers.
 */
async function loadSpecialtyNames(
  rows: RequestRow[],
): Promise<Map<string, string[]>> {
  const supabase = getSupabaseAdminClient();
  const doctorIds = unique(
    rows.filter((row) => !row.specialty_id).map((row) => row.doctor_id),
  );

  const doctorSpecialtyIds = new Map<string, string[]>();
  if (doctorIds.length > 0) {
    const { data, error } = await supabase
      .from("doctor_specialties")
      .select("doctor_id, specialty_id")
      .in("doctor_id", doctorIds);
    if (error) {
      throw new Error("Unable to load doctor specialties.");
    }
    for (const link of data ?? []) {
      doctorSpecialtyIds.set(link.doctor_id, [
        ...(doctorSpecialtyIds.get(link.doctor_id) ?? []),
        link.specialty_id,
      ]);
    }
  }

  const specialtyIdsByRow = new Map(
    rows.map((row) => [
      row.id,
      row.specialty_id
        ? [row.specialty_id]
        : (doctorSpecialtyIds.get(row.doctor_id) ?? []),
    ]),
  );
  const specialtyIds = unique([...specialtyIdsByRow.values()].flat());
  if (specialtyIds.length === 0) {
    return new Map(rows.map((row) => [row.id, []]));
  }

  const { data, error } = await supabase
    .from("specialties")
    .select("id, name")
    .in("id", specialtyIds);
  if (error) {
    throw new Error("Unable to load specialties.");
  }
  const names = new Map((data ?? []).map((specialty) => [specialty.id, specialty.name]));

  return new Map(
    [...specialtyIdsByRow].map(([rowId, ids]) => [
      rowId,
      ids
        .flatMap((id) => {
          const name = names.get(id);
          return name ? [name] : [];
        })
        .sort((a, b) => a.localeCompare(b)),
    ]),
  );
}

async function toQueueItems(rows: RequestRow[]): Promise<RequestQueueItem[]> {
  if (rows.length === 0) {
    return [];
  }
  const [profiles, specialtyNames] = await Promise.all([
    loadProfiles(unique(rows.flatMap((row) => [row.patient_id, row.doctor_id]))),
    loadSpecialtyNames(rows),
  ]);
  const emails = await loadEmails(
    unique(
      rows.flatMap((row) => {
        const authUserId = profiles.get(row.patient_id)?.auth_user_id;
        return authUserId ? [authUserId] : [];
      }),
    ),
  );

  return rows.map((row) => {
    const patient = profiles.get(row.patient_id);
    if (!patient) {
      throw new Error("Unable to resolve a request patient.");
    }
    return {
      id: row.id,
      patientName: patient.full_name,
      patientEmail: patient.auth_user_id
        ? (emails.get(patient.auth_user_id) ?? null)
        : null,
      patientPhone: patient.phone?.trim() || null,
      doctorName: profiles.get(row.doctor_id)?.full_name.trim() || "Doctor",
      specialtyNames: specialtyNames.get(row.id) ?? [],
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      createdAt: row.created_at,
      status: row.status,
    } satisfies RequestQueueItem;
  });
}

async function loadHistory(appointmentId: string): Promise<RequestAuditEntry[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("appointment_audit_logs")
    .select(
      "id, actor_profile_id, action, previous_status, new_status, new_values, reason, created_at",
    )
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    throw new Error("Unable to load appointment history.");
  }

  const rows = data ?? [];
  const actors = await loadProfiles(
    unique(rows.flatMap((row) => (row.actor_profile_id ? [row.actor_profile_id] : []))),
  );

  return rows.map((row) => {
    const actor = row.actor_profile_id ? actors.get(row.actor_profile_id) : undefined;
    return {
      id: row.id,
      action: row.action,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      actorName: actor?.full_name.trim() || null,
      actorRole: actor?.role ?? null,
      reason: row.reason?.trim() || null,
      scheduledAt: scheduledAtFromAuditValues(row.new_values),
      createdAt: row.created_at,
    } satisfies RequestAuditEntry;
  });
}

/**
 * Front desk read model. Unlike the doctor repository, this selects patient
 * contact details (email and phone): staff need them to follow up on a
 * request (FD-001 decision 2026-11-03).
 */
export const supabaseFrontDeskRequestsRepository: FrontDeskRequestsReader = {
  async listRequests({ status, start, end, doctorId, specialtyId, limit }) {
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from("appointments")
      .select(REQUEST_SELECT)
      .eq("booking_source", AI_BOOKING_SOURCE);
    if (status) {
      query = query.eq("status", status);
    }
    if (start && end) {
      query = query.gte("scheduled_at", start).lt("scheduled_at", end);
    }
    if (doctorId) {
      query = query.eq("doctor_id", doctorId);
    }
    if (specialtyId) {
      // A request matches when it recorded this specialty or its doctor offers
      // it. Both ids are validated UUIDs, so the filter string is safe.
      const { data: links, error: linkError } = await supabase
        .from("doctor_specialties")
        .select("doctor_id")
        .eq("specialty_id", specialtyId);
      if (linkError) {
        throw new Error("Unable to load doctor specialties.");
      }
      const doctorIds = unique((links ?? []).map((link) => link.doctor_id));
      query =
        doctorIds.length > 0
          ? query.or(
              `specialty_id.eq.${specialtyId},doctor_id.in.(${doctorIds.join(",")})`,
            )
          : query.eq("specialty_id", specialtyId);
    }

    const { data, error } = await query
      .order("scheduled_at", { ascending: true })
      .limit(limit);
    if (error) {
      throw new Error("Unable to load appointment requests.");
    }
    return toQueueItems(data ?? []);
  },

  async getRequest(appointmentId) {
    const { data, error } = await getSupabaseAdminClient()
      .from("appointments")
      .select(REQUEST_SELECT)
      .eq("id", appointmentId)
      .eq("booking_source", AI_BOOKING_SOURCE)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the appointment request.");
    }
    if (!data) {
      return null;
    }

    const row: RequestRow = data;
    const [[item], history] = await Promise.all([
      toQueueItems([row]),
      loadHistory(row.id),
    ]);
    if (!item) {
      return null;
    }
    return {
      ...item,
      doctorId: row.doctor_id,
      bookingSource: row.booking_source,
      reason: row.reason?.trim() || null,
      rejectionReason: row.rejection_reason?.trim() || null,
      cancellationReason: row.cancellation_reason?.trim() || null,
      history,
    } satisfies RequestDetails;
  },
};

/**
 * Calls the migration 0009 functions. Each runs in one transaction: it locks
 * the appointment, re-checks the pending status (and, for confirm, the
 * doctor's availability), updates the row, and writes the audit entry.
 */
export const supabaseFrontDeskRequestsWriter: FrontDeskRequestsWriter = {
  async confirm({ appointmentId, staffId }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_confirm_appointment",
      { p_appointment_id: appointmentId, p_staff_id: staffId },
    );
    return error
      ? { ok: false, error: { code: error.code, message: error.message } }
      : { ok: true };
  },

  async reject({ appointmentId, staffId, reason }) {
    const { error } = await getSupabaseAdminClient().rpc(
      "cammi_connect_reject_appointment",
      { p_appointment_id: appointmentId, p_staff_id: staffId, p_reason: reason },
    );
    return error
      ? { ok: false, error: { code: error.code, message: error.message } }
      : { ok: true };
  },
};
