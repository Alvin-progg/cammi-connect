import "server-only";

import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { ChargeStore } from "./service";

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
    return {
      ok: true,
      appointmentId: row.appointment_id,
      payment: {
        status: row.payment_status,
        amountDueCentavos: row.amount_due_centavos,
        referenceCode: row.reference_code,
        deadline: row.deadline_at,
      },
    };
  },
};
