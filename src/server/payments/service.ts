import "server-only";

import type { PrivilegeChoice } from "@/lib/billing/compute";
import type { BookedPayment } from "@/lib/chat/schemas";
import type { PaymentChoice } from "@/lib/chat/state";
import type { HmoBookingOption } from "@/server/benefits/booking-options";
import {
  BOOKING_REJECTION_MESSAGES,
  EXCLUSION_VIOLATION,
  RAISED_EXCEPTION,
  SLOT_TAKEN_MESSAGE,
} from "@/server/appointments/service";

export type HmoOption = HmoBookingOption;

export type ChargedBookingInput = {
  patientId: string;
  doctorId: string;
  specialtyId: string;
  start: string;
  reason: string | null;
  privilege: PrivilegeChoice;
  payment: PaymentChoice;
  /** The amount on the summary the patient confirmed; the database refuses a mismatch. */
  expectedAmountDueCentavos: number;
};

export type ChargedBookingOutcome =
  | { ok: true; appointmentId: string; payment: BookedPayment }
  | { ok: false; message: string };

/**
 * Price reads and the atomic cammi_connect_book_with_charge call (0034). The
 * database computes the charge from its own prices; the expected amount only
 * guards against a price change between the summary and Confirm.
 */
export type ChargeStore = {
  /** The doctor's own fee, else the specialty default; null is "price on request". */
  getConsultationFee(input: { doctorId: string; specialtyId: string }): Promise<number | null>;
  /** BEN-05: the patient's saved memberships with the offer for this doctor (null: a service visit). */
  listHmoOptions(input: { patientId: string; doctorId: string | null }): Promise<HmoOption[]>;
  bookWithCharge(
    input: ChargedBookingInput,
  ): Promise<
    | { ok: true; appointmentId: string; payment: BookedPayment }
    | { ok: false; error: { code: string; message: string } }
  >;
};

/** Patient messages for the refusals 0034 adds; none names an amount. */
export const CHARGED_BOOKING_MESSAGES: Record<string, string> = {
  payment_too_soon:
    "That time starts too soon to pay before your visit. Please pick a later time.",
  price_changed:
    "The fee for this visit just changed. Please choose your time again to see the updated summary.",
  price_on_request:
    "The fee for this visit is available on request. Please contact the hospital front desk to book it.",
  hmo_unavailable: "That HMO isn't available for booking anymore. Please choose your time again.",
  hmo_required: "Please choose your HMO membership again.",
  hmo_not_verified: "That HMO membership isn't verified yet, so it can't be used for this visit.",
  hmo_not_accepted: "This doctor doesn't accept that HMO. Please choose another payment option.",
  hmo_accreditation_expired: "This doctor's HMO accreditation has ended. Please choose another payment option.",
  pwd_not_verified:
    "Your PWD discount needs a verified PWD ID. Choose another option, or add your PWD ID in your account.",
  invalid_member_number: "Please check your HMO member number and try again.",
  invalid_payment_choice: "That payment option isn't available for this visit.",
  invalid_specialty: "This doctor isn't taking appointments for that specialty.",
};

/**
 * Books a consultation as a `requested` appointment with its charge and
 * payment in one transaction. Known refusals become patient messages;
 * anything else throws without database details.
 */
export async function bookConsultationWithCharge(
  input: ChargedBookingInput,
  store: ChargeStore,
): Promise<ChargedBookingOutcome> {
  const result = await store.bookWithCharge(input);
  if (result.ok) {
    return result;
  }

  const { code, message } = result.error;
  if (code === EXCLUSION_VIOLATION) {
    return { ok: false, message: SLOT_TAKEN_MESSAGE };
  }
  if (code === RAISED_EXCEPTION) {
    const known = Object.hasOwn(CHARGED_BOOKING_MESSAGES, message)
      ? CHARGED_BOOKING_MESSAGES[message]
      : Object.hasOwn(BOOKING_REJECTION_MESSAGES, message)
        ? BOOKING_REJECTION_MESSAGES[message]
        : undefined;
    if (known) return { ok: false, message: known };
  }
  throw new Error("Unable to book the appointment.");
}
