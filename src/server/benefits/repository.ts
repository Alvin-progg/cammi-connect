import "server-only";

import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type {
  AccreditationStatus,
  AuthorizationStatus,
  CoverageStatus,
  VerificationStatus,
} from "@/lib/benefits/types";

import type { BenefitKind, BenefitsWriteStore } from "./service";

/**
 * Supabase implementation of the BEN-03 store. Writes go through the 0041 and
 * 0042 functions, which re-check roles; reads use the admin client and are
 * always scoped by the session's profile ID (or by staff role in the queue).
 */

export const BENEFIT_DOCUMENT_BUCKET = "benefit-documents";

const CODE_FALLBACK = "unknown";

function rpcFailure(error: { code?: string | null; message: string }): { ok: false; code: string } {
  // The SQL raises P0001 with a fixed message; the message is the code.
  return { ok: false, code: error.message || error.code || CODE_FALLBACK };
}

export const supabaseBenefitsWriteStore: BenefitsWriteStore = {
  async uploadDocument(path, bytes, contentType) {
    const { error } = await getSupabaseAdminClient()
      .storage.from(BENEFIT_DOCUMENT_BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error("Unable to store the document.");
  },

  async removeDocument(path) {
    await getSupabaseAdminClient().storage.from(BENEFIT_DOCUMENT_BUCKET).remove([path]);
  },

  async submitPwd(input) {
    const { error } = await getSupabaseAdminClient().rpc("cammi_connect_submit_pwd", {
      p_patient_id: input.patientId,
      p_pwd_id_number: input.idNumber,
      p_pwd_id_image_path: input.imagePath,
    });
    if (error) return rpcFailure(error);
    return { ok: true, value: undefined };
  },

  async submitHmo(input) {
    const { data, error } = await getSupabaseAdminClient().rpc("cammi_connect_submit_hmo", {
      p_patient_id: input.patientId,
      p_hmo_provider_id: input.providerId,
      p_membership_number: input.membershipNumber,
      p_hmo_card_image_path: input.cardPath ?? null,
    });
    if (error) return rpcFailure(error);
    return { ok: true, value: data };
  },

  async decideBenefit(input) {
    const client = getSupabaseAdminClient();
    const result =
      input.kind === "pwd"
        ? await client.rpc("cammi_connect_decide_pwd", {
            p_patient_id: input.recordId,
            p_staff_id: input.staffId,
            p_decision: input.decision,
            p_reason: input.reason ?? null,
          })
        : await client.rpc("cammi_connect_decide_hmo_membership", {
            p_patient_hmo_id: input.recordId,
            p_staff_id: input.staffId,
            p_decision: input.decision,
            p_reason: input.reason ?? null,
          });
    if (result.error) return rpcFailure(result.error);
    return { ok: true, value: result.data };
  },

  async saveAccreditation(input) {
    const { data, error } = await getSupabaseAdminClient().rpc("cammi_connect_save_doctor_hmo_accreditation", {
      p_doctor_id: input.doctorId,
      p_hmo_provider_id: input.providerId,
      p_status: input.status,
      p_valid_from: input.validFrom,
      p_valid_until: input.validUntil ?? null,
      p_actor_id: input.actorId,
    });
    if (error) return rpcFailure(error);
    return { ok: true, value: data };
  },

  async updateAppointmentHmo(input) {
    const { error } = await getSupabaseAdminClient().rpc("cammi_connect_update_appointment_hmo", {
      p_appointment_id: input.appointmentId,
      p_staff_id: input.staffId,
      p_authorization_status: input.authorization,
      p_coverage_status: input.coverage,
      p_loa_number: input.loaNumber ?? null,
      p_remarks: input.remarks ?? null,
    });
    if (error) return rpcFailure(error);
    return { ok: true, value: undefined };
  },

  async recordDocumentView(input) {
    const { data, error } = await getSupabaseAdminClient().rpc("cammi_connect_record_benefit_document_view", {
      p_kind: input.kind,
      p_record_id: input.recordId,
      p_staff_id: input.staffId,
    });
    if (error) return rpcFailure(error);
    return { ok: true, value: data };
  },

  async signDocument(path, expiresInSeconds) {
    const { data, error } = await getSupabaseAdminClient()
      .storage.from(BENEFIT_DOCUMENT_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error) throw new Error("Unable to open the document.");
    return data.signedUrl;
  },
};

// ---------------------------------------------------------------------------
// Reads for the pages
// ---------------------------------------------------------------------------

export type PwdRecord = {
  id: string;
  idNumber: string;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  hasDocument: boolean;
  updatedAt: string;
};

export type HmoRecord = {
  id: string;
  providerId: string;
  providerName: string;
  membershipNumber: string;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  hasCard: boolean;
  updatedAt: string;
};

export type ProviderOption = { id: string; name: string };

/** A patient's own PWD record and HMO memberships, for /account/benefits. */
export async function readPatientBenefits(patientId: string): Promise<{
  pwd: PwdRecord | null;
  hmo: HmoRecord[];
  providers: ProviderOption[];
}> {
  const client = getSupabaseAdminClient();
  const [pwdResult, hmoResult, providersResult] = await Promise.all([
    client
      .from("patient_pwd")
      .select("id, pwd_id_number, verification_status, rejection_reason, pwd_id_image_path, updated_at")
      .eq("patient_id", patientId)
      .maybeSingle(),
    client
      .from("patient_hmo")
      .select("id, hmo_provider_id, membership_number, verification_status, rejection_reason, hmo_card_image_path, updated_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true }),
    client.from("hmo_providers").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (pwdResult.error || hmoResult.error || providersResult.error) {
    throw new Error("Unable to load benefits.");
  }

  const providers = providersResult.data.map((row) => ({ id: row.id, name: row.name }));
  const nameOf = new Map(providers.map((provider) => [provider.id, provider.name]));
  const pwd = pwdResult.data
    ? {
        id: pwdResult.data.id,
        idNumber: pwdResult.data.pwd_id_number,
        verificationStatus: pwdResult.data.verification_status,
        rejectionReason: pwdResult.data.rejection_reason,
        hasDocument: pwdResult.data.pwd_id_image_path !== null,
        updatedAt: pwdResult.data.updated_at,
      }
    : null;
  const hmo = hmoResult.data.map((row) => ({
    id: row.id,
    providerId: row.hmo_provider_id,
    providerName: nameOf.get(row.hmo_provider_id) ?? "HMO provider",
    membershipNumber: row.membership_number,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason,
    hasCard: row.hmo_card_image_path !== null,
    updatedAt: row.updated_at,
  }));
  return { pwd, hmo, providers };
}

// ---------------------------------------------------------------------------
// Front desk and admin reads
// ---------------------------------------------------------------------------

export type BenefitQueueItem = {
  recordId: string;
  patientId: string;
  patientName: string;
  /** Full ID or membership number: front desk only, never in chat or public responses. */
  identifier: string;
  providerName: string | null;
  hasDocument: boolean;
  submittedAt: string;
};

async function namesById(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await getSupabaseAdminClient().from("profiles").select("id, full_name").in("id", ids);
  if (error) throw new Error("Unable to load names.");
  return new Map(data.map((row) => [row.id, row.full_name]));
}

/** Pending PWD declarations or HMO memberships, oldest first, for the queue. */
export async function readPendingBenefitQueue(kind: BenefitKind): Promise<BenefitQueueItem[]> {
  const client = getSupabaseAdminClient();
  if (kind === "pwd") {
    const { data, error } = await client
      .from("patient_pwd")
      .select("id, patient_id, pwd_id_number, pwd_id_image_path, updated_at")
      .eq("verification_status", "pending")
      .order("updated_at", { ascending: true });
    if (error) throw new Error("Unable to load the queue.");
    const names = await namesById(data.map((row) => row.patient_id));
    return data.map((row) => ({
      recordId: row.patient_id,
      patientId: row.patient_id,
      patientName: names.get(row.patient_id) ?? "Patient",
      identifier: row.pwd_id_number,
      providerName: null,
      hasDocument: row.pwd_id_image_path !== null,
      submittedAt: row.updated_at,
    }));
  }

  const { data, error } = await client
    .from("patient_hmo")
    .select("id, patient_id, hmo_provider_id, membership_number, hmo_card_image_path, updated_at")
    .eq("verification_status", "pending")
    .order("updated_at", { ascending: true });
  if (error) throw new Error("Unable to load the queue.");
  const [names, providers] = await Promise.all([
    namesById(data.map((row) => row.patient_id)),
    client.from("hmo_providers").select("id, name").in("id", data.map((row) => row.hmo_provider_id)),
  ]);
  if (providers.error) throw new Error("Unable to load the queue.");
  const providerNames = new Map(providers.data.map((row) => [row.id, row.name]));
  return data.map((row) => ({
    recordId: row.id,
    patientId: row.patient_id,
    patientName: names.get(row.patient_id) ?? "Patient",
    identifier: row.membership_number,
    providerName: providerNames.get(row.hmo_provider_id) ?? null,
    hasDocument: row.hmo_card_image_path !== null,
    submittedAt: row.updated_at,
  }));
}

export type BenefitHistoryEntry = {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
  reason: string | null;
};

/** Recent benefit decisions and document views, newest first. */
export async function readRecentBenefitHistory(limit: number): Promise<BenefitHistoryEntry[]> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("audit_logs")
    .select("id, action, actor_profile_id, created_at, reason")
    .like("action", "benefit.%")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Unable to load history.");
  const names = await namesById([...new Set(data.map((row) => row.actor_profile_id))]);
  return data.map((row) => ({
    id: row.id,
    action: row.action,
    actorName: names.get(row.actor_profile_id) ?? "Staff",
    createdAt: row.created_at,
    reason: row.reason,
  }));
}

export type AppointmentHmoView = {
  appointmentId: string;
  providerName: string;
  membershipNumber: string;
  accreditationStatus: AccreditationStatus | null;
  accreditationValidFrom: string | null;
  accreditationValidUntil: string | null;
  authorization: AuthorizationStatus;
  coverage: CoverageStatus;
  loaNumber: string | null;
  remarks: string | null;
};

/** The HMO authorization record of one appointment, for the request details panel. */
export async function readAppointmentHmo(appointmentId: string): Promise<AppointmentHmoView | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("appointment_hmo")
    .select(
      "appointment_id, provider_name_snapshot, membership_number_snapshot, accreditation_status_snapshot, accreditation_valid_from_snapshot, accreditation_valid_until_snapshot, authorization_status, coverage_status, loa_number, remarks",
    )
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (error) throw new Error("Unable to load HMO details.");
  if (!data) return null;
  return {
    appointmentId: data.appointment_id,
    providerName: data.provider_name_snapshot,
    membershipNumber: data.membership_number_snapshot,
    accreditationStatus: data.accreditation_status_snapshot,
    accreditationValidFrom: data.accreditation_valid_from_snapshot,
    accreditationValidUntil: data.accreditation_valid_until_snapshot,
    authorization: data.authorization_status,
    coverage: data.coverage_status,
    loaNumber: data.loa_number,
    remarks: data.remarks,
  };
}

export type DoctorAccreditationView = {
  id: string;
  providerId: string;
  providerName: string;
  status: AccreditationStatus;
  validFrom: string;
  validUntil: string | null;
};

/** A doctor's accreditation list plus the active providers for the add form (admin). */
export async function readDoctorAccreditations(doctorId: string): Promise<{
  accreditations: DoctorAccreditationView[];
  providers: ProviderOption[];
}> {
  const client = getSupabaseAdminClient();
  const [accreditationResult, providersResult] = await Promise.all([
    client
      .from("doctor_hmo_accreditations")
      .select("id, hmo_provider_id, status, valid_from, valid_until")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: true }),
    client.from("hmo_providers").select("id, name").order("name"),
  ]);
  if (accreditationResult.error || providersResult.error) throw new Error("Unable to load accreditations.");
  const providers = providersResult.data.map((row) => ({ id: row.id, name: row.name }));
  const nameOf = new Map(providers.map((provider) => [provider.id, provider.name]));
  return {
    accreditations: accreditationResult.data.map((row) => ({
      id: row.id,
      providerId: row.hmo_provider_id,
      providerName: nameOf.get(row.hmo_provider_id) ?? "HMO provider",
      status: row.status,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
    })),
    providers,
  };
}

/** Benefit context of one appointment for the front desk request details. */
export async function readRequestBenefits(appointmentId: string): Promise<{
  pwdVerified: boolean;
  hmo: AppointmentHmoView | null;
} | null> {
  const client = getSupabaseAdminClient();
  const { data: appointment, error: appointmentError } = await client
    .from("appointments")
    .select("patient_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (appointmentError) throw new Error("Unable to load benefits.");
  if (!appointment) return null;

  const [pwdResult, hmo] = await Promise.all([
    client
      .from("patient_pwd")
      .select("verification_status")
      .eq("patient_id", appointment.patient_id)
      .maybeSingle(),
    readAppointmentHmo(appointmentId),
  ]);
  if (pwdResult.error) throw new Error("Unable to load benefits.");
  return { pwdVerified: pwdResult.data?.verification_status === "verified", hmo };
}
