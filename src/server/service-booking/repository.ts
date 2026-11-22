import "server-only";

import type { BookableService } from "@/lib/services/booking";
import { getSupabaseAdminClient } from "@/server/db/admin-client";

import type { ServiceBookingStore } from "./service";

/** "07:00:00" from Postgres as "07:00", like the doctor schedule repository. */
function hhmm(time: string): string {
  return time.slice(0, 5);
}

export const supabaseServiceBookingRepository: ServiceBookingStore = {
  async listBookableServices() {
    const { data, error } = await getSupabaseAdminClient()
      .from("services")
      .select(
        "id, name, category, booking_mode, price_centavos, vatable, philhealth_benefit_centavos, hmo_coverable, requires_doctor_request, daily_capacity",
      )
      .eq("is_active", true)
      .in("booking_mode", ["walk_in", "scheduled"])
      .not("price_centavos", "is", null)
      .order("name", { ascending: true });
    if (error) {
      throw new Error("Unable to load services.");
    }
    return (data ?? []).flatMap((row): BookableService[] =>
      (row.booking_mode === "walk_in" || row.booking_mode === "scheduled") &&
      row.price_centavos !== null
        ? [
            {
              id: row.id,
              name: row.name,
              category: row.category,
              bookingMode: row.booking_mode,
              priceCentavos: row.price_centavos,
              vatable: row.vatable,
              philhealthBenefitCentavos: row.philhealth_benefit_centavos,
              hmoCoverable: row.hmo_coverable,
              requiresDoctorRequest: row.requires_doctor_request,
              dailyCapacity: row.daily_capacity,
            },
          ]
        : [],
    );
  },

  async listPeriods(serviceIds) {
    if (serviceIds.length === 0) return [];
    const { data, error } = await getSupabaseAdminClient()
      .from("service_schedules")
      .select(
        "service_id, day_of_week, start_time, end_time, slot_minutes, capacity_per_slot, effective_from, effective_until, is_active",
      )
      .in("service_id", serviceIds)
      .eq("is_active", true);
    if (error) {
      throw new Error("Unable to load service hours.");
    }
    return (data ?? []).map((row) => ({
      serviceId: row.service_id,
      dayOfWeek: row.day_of_week,
      startTime: hhmm(row.start_time),
      endTime: hhmm(row.end_time),
      slotMinutes: row.slot_minutes,
      capacityPerSlot: row.capacity_per_slot,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      isActive: row.is_active,
    }));
  },

  async listHolidays({ from, to }) {
    const { data, error } = await getSupabaseAdminClient()
      .from("schedule_exceptions")
      .select("start_datetime, end_datetime")
      .is("doctor_id", null)
      .lt("start_datetime", to.toISOString())
      .gt("end_datetime", from.toISOString());
    if (error) {
      throw new Error("Unable to load holidays.");
    }
    return (data ?? []).map((row) => ({
      start: new Date(row.start_datetime),
      end: new Date(row.end_datetime),
    }));
  },

  async getLoad({ serviceIds, from, to }) {
    if (serviceIds.length === 0) return [];
    const { data, error } = await getSupabaseAdminClient().rpc("cammi_connect_service_load", {
      p_service_ids: serviceIds,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    if (error) {
      throw new Error("Unable to load service bookings.");
    }
    return (data ?? []).map((row) => ({
      serviceId: row.service_id,
      start: new Date(row.scheduled_at),
      bookings: row.bookings,
    }));
  },

  async listRequirements(serviceIds, today) {
    if (serviceIds.length === 0) return [];
    const { data, error } = await getSupabaseAdminClient()
      .from("service_requirements")
      .select("service_id, title, description")
      .in("service_id", serviceIds)
      .eq("status", "published")
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("title", { ascending: true });
    if (error) {
      throw new Error("Unable to load requirements.");
    }
    return (data ?? []).flatMap((row) =>
      row.service_id ? [{ serviceId: row.service_id, title: row.title, description: row.description }] : [],
    );
  },

  async bookService(input) {
    const { payment } = input;
    const supabase = getSupabaseAdminClient();
    // 0042: as the consultation wrapper; service visits check verification only.
    const { data, error } = await supabase.rpc("cammi_connect_book_service_with_saved_hmo", {
      p_patient_id: input.patientId,
      p_service_ids: input.serviceIds,
      p_visit_date: input.visitDate,
      p_scheduled_at: input.start,
      p_reason: input.reason,
      p_privilege: input.privilege,
      p_payer: payment.payer,
      p_payment_method: payment.payer === "self" ? payment.method : null,
      p_patient_hmo_id: payment.payer === "hmo" ? payment.patientHmoId : null,
      p_expected_amount_due_centavos: input.expectedAmountDueCentavos,
    });
    if (error) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    const [row] = data ?? [];
    if (!row) {
      throw new Error("Unable to book the service.");
    }
    const { data: paymentRow, error: paymentError } = await supabase
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
 * PAY-07: what a service visit is called wherever a doctor's name would be
 * shown ("CBC with platelet count + Urinalysis"), from its charge lines, else
 * its service. Consultations are not in the map.
 */
export async function loadServiceVisitLabels(
  rows: readonly { id: string; service_id: string | null }[],
): Promise<Map<string, string>> {
  const visits = rows.flatMap((row) => (row.service_id ? [{ id: row.id, serviceId: row.service_id }] : []));
  const labels = new Map<string, string>();
  if (visits.length === 0) return labels;

  const supabase = getSupabaseAdminClient();
  const serviceIds = [...new Set(visits.map((row) => row.serviceId))];
  const [services, charges] = await Promise.all([
    supabase.from("services").select("id, name").in("id", serviceIds),
    supabase
      .from("appointment_charges")
      .select("id, appointment_id")
      .in(
        "appointment_id",
        visits.map((row) => row.id),
      ),
  ]);
  if (services.error || charges.error) {
    throw new Error("Unable to load service visits.");
  }
  const chargeIds = (charges.data ?? []).map((charge) => charge.id);
  const items = chargeIds.length
    ? await supabase
        .from("appointment_charge_items")
        .select("charge_id, line_number, description")
        .in("charge_id", chargeIds)
        .order("line_number", { ascending: true })
    : { data: [], error: null };
  if (items.error) {
    throw new Error("Unable to load service visits.");
  }

  const serviceNames = new Map((services.data ?? []).map((row) => [row.id, row.name]));
  const chargeVisit = new Map((charges.data ?? []).map((charge) => [charge.id, charge.appointment_id]));
  const lines = new Map<string, string[]>();
  for (const item of items.data ?? []) {
    const visitId = chargeVisit.get(item.charge_id);
    if (visitId) lines.set(visitId, [...(lines.get(visitId) ?? []), item.description]);
  }
  for (const row of visits) {
    labels.set(
      row.id,
      lines.get(row.id)?.join(" + ") ?? serviceNames.get(row.serviceId) ?? "Hospital service",
    );
  }
  return labels;
}
