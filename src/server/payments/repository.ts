import "server-only";

import type { PaymentStatus } from "@/lib/billing/payments";
import type { BookedPayment } from "@/lib/chat/schemas";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { ReceiptStore } from "./receipts";
import type { ChargeStore } from "./service";
import type { PaymentDecisionStore } from "./verification";

const RECEIPT_BUCKET = "payment-receipts";

/**
 * Prices and HMOs are read live, never from the reference cache: the
 * summary must show what cammi_connect_book_with_charge will charge.
 */
export const supabaseChargeRepository: ChargeStore = {
  async getConsultationFee({ doctorId, specialtyId }) {
    const supabase = getSupabaseAdminClient();
    const [doctor, specialty] = await Promise.all([
      supabase.from("doctors").select("consultation_fee_centavos").eq("id", doctorId).maybeSingle(),
      supabase
        .from("specialties")
        .select("default_consultation_fee_centavos")
        .eq("id", specialtyId)
        .maybeSingle(),
    ]);
    if (doctor.error || specialty.error) {
      throw new Error("Unable to load the consultation fee.");
    }
    return (
      doctor.data?.consultation_fee_centavos ??
      specialty.data?.default_consultation_fee_centavos ??
      null
    );
  },

  async listActiveHmoProviders() {
    const { data, error } = await getSupabaseAdminClient()
      .from("hmo_providers")
      .select("id, name, copay_centavos")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) {
      throw new Error("Unable to load HMO providers.");
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      copayCentavos: row.copay_centavos,
    }));
  },

  async bookWithCharge(input) {
    const { payment } = input;
    const { data, error } = await getSupabaseAdminClient().rpc("cammi_connect_book_with_charge", {
      p_doctor_id: input.doctorId,
      p_specialty_id: input.specialtyId,
      p_patient_id: input.patientId,
      p_scheduled_at: input.start,
      p_reason: input.reason,
      p_privilege: input.privilege,
      p_payer: payment.payer,
      p_payment_method: payment.payer === "self" ? payment.method : null,
      p_hmo_provider_id: payment.payer === "hmo" ? payment.hmoProviderId : null,
      p_hmo_member_number: payment.payer === "hmo" ? payment.memberNumber : null,
      p_expected_amount_due_centavos: input.expectedAmountDueCentavos,
    });
    if (error) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    const [row] = data ?? [];
    if (!row) {
      throw new Error("Unable to book the appointment.");
    }
    // The receipt route needs the payment's ID (PAY-04).
    const { data: paymentRow, error: paymentError } = await getSupabaseAdminClient()
      .from("payments")
      .select("id, method")
      .eq("appointment_id", row.appointment_id)
      .single();
    if (paymentError) {
      throw new Error("Unable to load the payment.");
    }
    return {
      ok: true,
      appointmentId: row.appointment_id,
      payment: {
        id: paymentRow.id,
        method: paymentRow.method,
        status: row.payment_status,
        amountDueCentavos: row.amount_due_centavos,
        referenceCode: row.reference_code,
        deadline: row.deadline_at,
      },
    };
  },
};

/**
 * PAY-04 receipt uploads. Payments are reached only through the patient's
 * own appointments, and objects go to the private bucket with the
 * service-role key, which never leaves the server.
 */
export const supabaseReceiptRepository: ReceiptStore = {
  async findPaymentForPatient(patientId, paymentId) {
    const supabase = getSupabaseAdminClient();
    const { data: payment, error } = await supabase
      .from("payments")
      .select("appointment_id, status, attempts")
      .eq("id", paymentId)
      .maybeSingle();
    if (error) {
      throw new Error("Unable to load the payment.");
    }
    if (!payment) return null;
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id")
      .eq("id", payment.appointment_id)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (appointmentError) {
      throw new Error("Unable to load the payment.");
    }
    return appointment ? { status: payment.status, attempts: payment.attempts } : null;
  },

  async countRecentUploads(patientId, since) {
    const { count, error } = await getSupabaseAdminClient()
      .from("payment_receipts")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .gt("uploaded_at", since.toISOString());
    if (error) {
      throw new Error("Unable to count receipts.");
    }
    return count ?? 0;
  },

  async uploadObject(path, bytes, contentType) {
    const { error } = await getSupabaseAdminClient()
      .storage.from(RECEIPT_BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) {
      throw new Error("Unable to store the receipt.");
    }
  },

  async removeObject(path) {
    const { error } = await getSupabaseAdminClient().storage.from(RECEIPT_BUCKET).remove([path]);
    if (error) {
      throw new Error("Unable to remove the receipt.");
    }
  },

  async submitReceipt({ patientId, paymentId, path, contentType, sizeBytes }) {
    const { error } = await getSupabaseAdminClient().rpc("cammi_connect_submit_payment_receipt", {
      p_payment_id: paymentId,
      p_patient_id: patientId,
      p_storage_path: path,
      p_content_type: contentType,
      p_size_bytes: sizeBytes,
    });
    if (!error) return { ok: true };
    if (error.code === "P0001") return { ok: false, code: error.message };
    throw new Error("Unable to submit the receipt.");
  },
};

const PAYABLE_LATER: PaymentStatus[] = ["awaiting_payment", "rejected", "submitted"];

/**
 * "Pay later" (PAY-04): payments still waiting on the patient or the front
 * desk, keyed by appointment ID, for the patient's requested appointments.
 */
export async function listOpenPaymentsForPatient(
  patientId: string,
): Promise<Record<string, BookedPayment>> {
  const supabase = getSupabaseAdminClient();
  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", patientId)
    .eq("status", "requested");
  if (error) {
    throw new Error("Unable to load payments.");
  }
  if (!appointments?.length) return {};

  const { data: payments, error: paymentError } = await supabase
    .from("payments")
    .select("id, appointment_id, charge_id, status, method, amount_due_centavos, deadline_at")
    .in("appointment_id", appointments.map((appointment) => appointment.id))
    .in("status", PAYABLE_LATER);
  if (paymentError) {
    throw new Error("Unable to load payments.");
  }
  if (!payments?.length) return {};

  const { data: charges, error: chargeError } = await supabase
    .from("appointment_charges")
    .select("id, reference_code")
    .in("id", payments.map((payment) => payment.charge_id));
  if (chargeError) {
    throw new Error("Unable to load payments.");
  }
  const references = new Map((charges ?? []).map((charge) => [charge.id, charge.reference_code]));

  return Object.fromEntries(
    payments.map((payment) => [
      payment.appointment_id,
      {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amountDueCentavos: payment.amount_due_centavos,
        referenceCode: references.get(payment.charge_id) ?? "",
        deadline: payment.deadline_at,
      } satisfies BookedPayment,
    ]),
  );
}

type DecisionRpcResult = {
  data: { patient_id: string; amount_due_centavos: number }[] | null;
  error: { code: string; message: string } | null;
};

function toDecisionOutcome({ data, error }: DecisionRpcResult) {
  if (error) return { ok: false as const, error: { code: error.code, message: error.message } };
  const [row] = data ?? [];
  if (!row) throw new Error("Unable to update the payment.");
  return { ok: true as const, patientId: row.patient_id, amountDueCentavos: row.amount_due_centavos };
}

/**
 * PAY-05 front desk decisions (0036). The functions re-check the staff role,
 * so a caller that skipped the session check still cannot decide.
 */
export const supabasePaymentDecisionRepository: PaymentDecisionStore = {
  async verify(input) {
    return toDecisionOutcome(
      await getSupabaseAdminClient().rpc("cammi_connect_verify_payment", {
        p_payment_id: input.paymentId,
        p_staff_id: input.staffId,
        p_transaction_reference: input.transactionReference,
        p_amount_received_centavos: input.amountReceivedCentavos,
        p_received_at: input.receivedAt,
      }),
    );
  },

  async reject(input) {
    return toDecisionOutcome(
      await getSupabaseAdminClient().rpc("cammi_connect_reject_payment_receipt", {
        p_payment_id: input.paymentId,
        p_staff_id: input.staffId,
        p_reason_code: input.reasonCode,
        p_reason: input.rejectedReason,
      }),
    );
  },

  async markRefunded(input) {
    return toDecisionOutcome(
      await getSupabaseAdminClient().rpc("cammi_connect_mark_refunded", {
        p_payment_id: input.paymentId,
        p_staff_id: input.staffId,
        p_refund_reference: input.refundReference,
      }),
    );
  },

  async recordReceiptView({ paymentId, staffId }) {
    const { data, error } = await getSupabaseAdminClient().rpc("cammi_connect_record_receipt_view", {
      p_payment_id: paymentId,
      p_staff_id: staffId,
    });
    if (error) return { ok: false, error: { code: error.code, message: error.message } };
    return { ok: true, storagePath: data };
  },

  async signReceiptUrl(storagePath, expiresInSeconds) {
    const { data, error } = await getSupabaseAdminClient()
      .storage.from(RECEIPT_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error) {
      throw new Error("Unable to open the receipt.");
    }
    return data.signedUrl;
  },
};
