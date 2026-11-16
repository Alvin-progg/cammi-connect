import "server-only";

import { todayInManila } from "@/lib/appointments/filters";
import { computeCharge, type PrivilegeChoice } from "@/lib/billing/compute";
import { formatManilaShortDate, formatManilaTime } from "@/lib/appointments/format";
import {
  BOOKING_COPY,
  beyondHorizonCopy,
  doctorDisplayName,
  groupSlotsByManilaDate,
  manilaDateOf,
} from "@/lib/chat/booking";
import {
  addDays,
  bookingHorizonEnd,
  matchSpecialtiesByName,
  resolvePreferredDate,
} from "@/lib/chat/resolve";
import {
  PAYMENT_COPY,
  PRIVILEGE_LABELS,
  consultationLine,
  hmoPendingCopy,
  maskMemberNumber,
  paymentChoiceLabel,
  paymentRequestCopy,
} from "@/lib/chat/payment";
import { routeToSpecialty, type FirstContactSettings } from "@/lib/chat/routing";
import {
  BOOKING_OFFER,
  MEDICAL_ADVICE_DECLINE,
  ROUTING_COPY,
} from "@/lib/chat/safety";
import type {
  BookedPayment,
  BookingEvent,
  ChargeSummary,
  ChatMessagePayload,
  DoctorOption,
  IntentExtraction,
} from "@/lib/chat/schemas";
import {
  BOOKING_REASON_MAX_LENGTH,
  acceptsEvent,
  applyCorrection,
  type BookingDraft,
  type BookingState,
  type CareNeed,
  type PaymentChoice,
} from "@/lib/chat/state";
import type { DoctorSummary, Specialty } from "@/lib/directory/types";

import type { ChatTools, TimeSlot } from "./tools";

/** AI-APT-002: the concern summary kept as the reason for visit. */
const CONCERN_MAX_LENGTH = 200;

/** How many Manila dates one slot picker covers. */
const SLOT_WINDOW_DAYS = 7;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

export type BookingContext = {
  patientId: string;
  state: BookingState;
  now: Date;
  /** The admin's `appointment.max_advance_days`: the last bookable date is today plus this. */
  horizonDays: number;
  /** The admin's first-contact specialties, for concerns routing cannot match (AI-APT-002). */
  firstContact: FirstContactSettings;
  tools: ChatTools;
  /**
   * Guarded update from awaiting_confirmation to `next`. Returns false when
   * another request already claimed this booking, so a double Confirm cannot
   * book twice.
   */
  claimBooking: (next: BookingState) => Promise<boolean>;
  /**
   * The admin's `payment.enabled` (PAY-03). When on, the discount and payer
   * questions follow the slot and Confirm books with a charge; when off,
   * booking works as before with no charge.
   */
  paymentEnabled?: boolean;
};

/** `state` is the context's own object when nothing changed, so callers can skip saving it. */
export type BookingReply = {
  reply: string;
  payload: ChatMessagePayload | null;
  state: BookingState;
};

/** Steps in which a typed booking message corrects the current draft instead of starting over. */
const IN_PROGRESS_STEPS: readonly BookingState["step"][] = [
  "offering_booking",
  "choosing_specialty",
  "choosing_doctor",
  "choosing_doctor_specialty",
  "choosing_slot",
  "choosing_privilege",
  "choosing_payer",
  "awaiting_confirmation",
  "failed",
];

const EVENT_LABELS: Record<BookingEvent["type"], string> = {
  select_specialty: "Chose a specialty",
  select_doctor: "Chose a doctor",
  more_slots: "Show later dates",
  select_slot: "Chose a time",
  confirm_booking: "Confirm booking",
  change_booking: "Change booking",
  cancel_booking: "Stop booking",
  update_reason: "Edited the reason for visit",
  accept_booking_offer: "Yes, book",
  select_privilege: "Chose a discount",
  select_payer: "Chose how to pay",
};

const CHANGE_LABELS = {
  specialty: "Change the specialty",
  doctor: "Change the doctor",
  slot: "Change the time",
  payment: "Change the discount or payment",
} as const;

function withLead(lead: string | undefined, reply: string): string {
  return lead ? `${lead} ${reply}` : reply;
}

function toDoctorOption(doctor: DoctorSummary): DoctorOption {
  return {
    id: doctor.id,
    name: doctorDisplayName(doctor.fullName),
    departmentName: doctor.departmentName,
    specialties: doctor.specialties.map((specialty) => specialty.name),
  };
}

function specialtyOptions(specialties: { id: string; name: string }[]): ChatMessagePayload {
  return {
    kind: "specialty_options",
    specialties: specialties.map(({ id, name }) => ({ id, name })),
  };
}

function inclusiveDaysBetween(from: string, to: string): number {
  const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(span / DAY_MILLISECONDS) + 1;
}

function clip(value: string | null | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

async function askForSpecialty(
  draft: BookingDraft,
  ctx: BookingContext,
  reply: string = BOOKING_COPY.chooseSpecialty,
  excludeId?: string,
): Promise<BookingReply> {
  const specialties = (await ctx.tools.getSpecialties()).filter(
    (entry) => entry.id !== excludeId,
  );
  if (specialties.length === 0) {
    return { reply: BOOKING_COPY.noSpecialties, payload: null, state: { step: "idle", draft: {} } };
  }
  return {
    reply,
    payload: specialtyOptions(specialties),
    state: {
      step: "choosing_specialty",
      draft: { ...draft, specialtyId: undefined, doctorId: undefined, slotStart: undefined },
    },
  };
}

/**
 * Shows the doctor's slots for one window from the preferred date. When the
 * window is empty it offers the next window (inside the horizon) and other
 * active doctors of the same specialty.
 */
async function offerSlots(
  doctor: DoctorSummary,
  draft: BookingDraft,
  ctx: BookingContext,
  lead?: string,
): Promise<BookingReply> {
  const today = todayInManila(ctx.now);
  const horizonEnd = bookingHorizonEnd(ctx.now, ctx.horizonDays);
  const fromDate =
    draft.preferredDate && draft.preferredDate > today ? draft.preferredDate : today;
  const days = Math.max(
    1,
    Math.min(SLOT_WINDOW_DAYS, inclusiveDaysBetween(fromDate, horizonEnd)),
  );
  const nextFrom = addDays(fromDate, days);
  const doctorName = doctorDisplayName(doctor.fullName);

  const slots = await ctx.tools.getDoctorAvailability({
    doctorId: doctor.id,
    specialtyId: draft.specialtyId,
    fromDate,
    days,
    preferredTime: draft.preferredTime,
  });

  const alternatives =
    slots.length === 0 && draft.specialtyId
      ? (await ctx.tools.getDoctorsBySpecialty({ specialtyId: draft.specialtyId }))
          .filter((entry) => entry.id !== doctor.id)
          .map(toDoctorOption)
      : [];

  const timeNote = draft.preferredTime ? " that match your preferred time" : "";
  let reply = `Here are ${doctorName}'s available times${timeNote}. Choose the one that suits you.`;
  if (slots.length === 0) {
    const period = days === 1 ? "day" : `${days} days`;
    const from = formatManilaShortDate(`${fromDate}T00:00:00+08:00`);
    reply = `${doctorName} has no available times${timeNote} in the ${period} from ${from}.`;
    if (alternatives.length > 0) {
      reply += " You can look at later dates or choose another doctor.";
    }
  }

  return {
    reply: withLead(lead, reply),
    payload: {
      kind: "slot_picker",
      doctorName,
      days: groupSlotsByManilaDate(slots),
      nextFromDate: nextFrom <= horizonEnd ? nextFrom : null,
      alternatives,
    },
    state: {
      step: "choosing_slot",
      draft: { ...draft, doctorId: doctor.id, slotStart: undefined },
    },
  };
}

/**
 * Picks the next step from what the draft holds: a doctor goes to slots (via
 * a specialty choice when the doctor has several), a specialty goes to its
 * doctors, and nothing asks for a specialty. Every name comes from the
 * database, and inactive entries drop out of the draft.
 */
async function advance(
  draft: BookingDraft,
  ctx: BookingContext,
  lead?: string,
): Promise<BookingReply> {
  if (draft.doctorId) {
    const doctor = await ctx.tools.getDoctor({ doctorId: draft.doctorId });
    if (!doctor) {
      return advance(
        { ...draft, doctorId: undefined, slotStart: undefined },
        ctx,
        withLead(lead, BOOKING_COPY.doctorUnavailable),
      );
    }

    const hasDraftSpecialty = doctor.specialties.some((entry) => entry.id === draft.specialtyId);
    if (!hasDraftSpecialty && doctor.specialties.length > 1) {
      const name = doctorDisplayName(doctor.fullName);
      return {
        reply: withLead(
          lead,
          `${name} sees patients for several specialties. Which one is this visit for?`,
        ),
        payload: specialtyOptions(doctor.specialties),
        state: {
          step: "choosing_doctor_specialty",
          draft: { ...draft, specialtyId: undefined, slotStart: undefined },
        },
      };
    }
    const specialtyId = hasDraftSpecialty ? draft.specialtyId : doctor.specialties[0]?.id;
    return offerSlots(doctor, { ...draft, specialtyId }, ctx, lead);
  }

  if (draft.specialtyId) {
    const specialty = await findSpecialty(ctx, draft.specialtyId);
    if (!specialty) {
      return askForSpecialty(
        draft,
        ctx,
        withLead(lead, `${BOOKING_COPY.optionUnavailable} ${BOOKING_COPY.chooseSpecialty}`),
      );
    }
    const doctors = await ctx.tools.getDoctorsBySpecialty({ specialtyId: specialty.id });
    if (doctors.length === 0) {
      return askForSpecialty(
        draft,
        ctx,
        withLead(
          lead,
          `No doctors are taking ${specialty.name} appointments right now. Would you like another specialty?`,
        ),
        specialty.id,
      );
    }
    return {
      reply: withLead(
        lead,
        `These doctors see patients for ${specialty.name}. Who would you like to see?`,
      ),
      payload: { kind: "doctor_options", doctors: doctors.map(toDoctorOption) },
      state: { step: "choosing_doctor", draft: { ...draft, slotStart: undefined } },
    };
  }

  return askForSpecialty(draft, ctx, withLead(lead, BOOKING_COPY.chooseSpecialty));
}

async function findSpecialty(
  ctx: BookingContext,
  specialtyId: string | undefined,
): Promise<Specialty | undefined> {
  if (!specialtyId) return undefined;
  return (await ctx.tools.getSpecialties()).find((entry) => entry.id === specialtyId);
}

/** The care-need fields the model returned; absent ones are left out so they don't overwrite saved ones. */
function careNeedFrom(extraction: IntentExtraction): CareNeed {
  const need: CareNeed = {};
  if (extraction.specialtyCandidates?.length) need.specialtyCandidates = extraction.specialtyCandidates;
  if (extraction.routingConfidence) need.routingConfidence = extraction.routingConfidence;
  if (extraction.age != null) need.age = extraction.age;
  if (extraction.forSomeoneElse != null) need.forSomeoneElse = extraction.forSomeoneElse;
  return need;
}

function concernFrom(extraction: IntentExtraction): string | undefined {
  return clip(extraction.concern, CONCERN_MAX_LENGTH) ?? clip(extraction.reason, BOOKING_REASON_MAX_LENGTH);
}

/**
 * Need-based routing (AI-APT-002): shows the doctors of the specialty the
 * rules in src/lib/chat/routing.ts pick, with [Change specialty] and any
 * one-tap alternative. The reply is a template naming only the database
 * specialty; no model text reaches the patient.
 */
async function routeBooking(draft: BookingDraft, ctx: BookingContext): Promise<BookingReply> {
  const need = draft.careNeed ?? {};
  if (need.forSomeoneElse && need.age === undefined && !draft.ageAsked) {
    return askForSpecialty({ ...draft, ageAsked: true }, ctx, ROUTING_COPY.askAge);
  }

  const specialties = await ctx.tools.getRoutableSpecialties();
  const route = routeToSpecialty(need, specialties, ctx.firstContact);
  const specialty = specialties.find((entry) => entry.id === route?.specialtyId);
  if (!route || !specialty) {
    return askForSpecialty(draft, ctx);
  }

  // Once routed, the care need has done its job; [Change specialty] uses the chips.
  const routedDraft = applyCorrection(
    { ...draft, careNeed: undefined, ageAsked: undefined },
    { specialtyId: specialty.id },
  );
  const doctors = await ctx.tools.getDoctorsBySpecialty({ specialtyId: specialty.id });
  if (doctors.length === 0) {
    return advance(routedDraft, ctx);
  }

  const alternative = specialties.find((entry) => entry.id === route.alternativeId);
  return {
    reply:
      route.reason === "first_contact"
        ? ROUTING_COPY.firstContact(specialty.name)
        : ROUTING_COPY.routed(specialty.name),
    payload: {
      kind: "doctor_options",
      doctors: doctors.map(toDoctorOption),
      changeSpecialty: true,
      ...(alternative ? { alternative: { id: alternative.id, name: alternative.name } } : {}),
    },
    state: { step: "choosing_doctor", draft: { ...routedDraft, slotStart: undefined } },
  };
}

/**
 * A non-urgent medical-advice message: decline, then offer to book a doctor
 * who can check the concern. Routing waits for [Yes, book], so the care need
 * is kept in the draft. A booking already in progress is left alone.
 */
export function declineAndOfferBooking(
  extraction: IntentExtraction,
  ctx: BookingContext,
): BookingReply {
  if (IN_PROGRESS_STEPS.includes(ctx.state.step) && ctx.state.step !== "offering_booking") {
    return { reply: MEDICAL_ADVICE_DECLINE, payload: null, state: ctx.state };
  }
  const reason = concernFrom(extraction);
  return {
    reply: `${MEDICAL_ADVICE_DECLINE} ${BOOKING_OFFER}`,
    payload: { kind: "book_offer" },
    state: {
      step: "offering_booking",
      draft: { ...(reason ? { reason } : {}), careNeed: careNeedFrom(extraction) },
    },
  };
}

/**
 * A typed booking request: starts a new draft, or corrects the one in
 * progress. A named doctor (Path B) takes precedence over a named specialty
 * (Path A); a specialty named alongside a doctor picks among the doctor's own.
 * With neither, a described concern is routed to a specialty (AI-APT-002).
 */
export async function startOrCorrectBooking(
  extraction: IntentExtraction,
  ctx: BookingContext,
): Promise<BookingReply> {
  const { state, tools } = ctx;
  const draft: BookingDraft = IN_PROGRESS_STEPS.includes(state.step) ? state.draft : {};
  const changes: Partial<BookingDraft> = {};

  const preferredDate = extraction.preferredDate?.trim();
  if (preferredDate) {
    const resolved = resolvePreferredDate(preferredDate, ctx.now, ctx.horizonDays);
    if (resolved.status === "past") {
      return { reply: BOOKING_COPY.dateInPast, payload: null, state };
    }
    if (resolved.status === "beyond_horizon") {
      return { reply: beyondHorizonCopy(ctx.horizonDays), payload: null, state };
    }
    // An unreadable date is ignored rather than guessed.
    if (resolved.status === "ok") changes.preferredDate = resolved.date;
  }
  const preferredTime = clip(extraction.preferredTime, 50);
  if (preferredTime) changes.preferredTime = preferredTime;
  const reason = concernFrom(extraction);
  if (reason) changes.reason = reason;

  const doctorName = extraction.doctorName?.trim();
  const specialtyName = extraction.specialtyName?.trim();

  if (doctorName) {
    const lookup = await tools.getDoctorDetails({ doctorName });
    if (lookup.status === "unknown") {
      return askForSpecialty(
        applyCorrection(draft, changes),
        ctx,
        `${BOOKING_COPY.doctorNotFound} ${BOOKING_COPY.chooseSpecialty}`,
      );
    }
    if (lookup.status === "several") {
      return {
        reply: BOOKING_COPY.severalDoctors,
        payload: { kind: "doctor_options", doctors: lookup.doctors.map(toDoctorOption) },
        state: {
          step: "choosing_doctor",
          draft: applyCorrection(draft, { ...changes, doctorId: undefined }),
        },
      };
    }
    changes.doctorId = lookup.doctor.id;
    if (specialtyName) {
      const matches = matchSpecialtiesByName(specialtyName, lookup.doctor.specialties);
      if (matches.length === 1) changes.specialtyId = matches[0].id;
    }
  } else if (specialtyName) {
    const specialties = await tools.getSpecialties();
    const matches = matchSpecialtiesByName(specialtyName, specialties);
    if (matches.length === 0) {
      return askForSpecialty(applyCorrection(draft, changes), ctx, BOOKING_COPY.specialtyNotFound);
    }
    if (matches.length > 1) {
      return {
        reply: BOOKING_COPY.severalSpecialties,
        payload: specialtyOptions(matches),
        state: {
          step: "choosing_specialty",
          draft: { ...applyCorrection(draft, changes), doctorId: undefined, slotStart: undefined },
        },
      };
    }
    changes.specialtyId = matches[0].id;
  } else {
    const corrected = applyCorrection(draft, changes);
    // Routing only picks the first specialty. Later in the flow the model may
    // repeat the concern from history; that must not throw away the patient's choices.
    if (!corrected.doctorId && !corrected.specialtyId) {
      const careNeed = { ...draft.careNeed, ...careNeedFrom(extraction) };
      const describedConcern = Boolean(corrected.reason) || Object.keys(careNeed).length > 0;
      return describedConcern
        ? routeBooking({ ...corrected, careNeed }, ctx)
        : askForSpecialty(corrected, ctx, ROUTING_COPY.askConcern);
    }
  }

  return advance(applyCorrection(draft, changes), ctx);
}

/** The slot, if the database still offers it; availability is re-read, never trusted from the card. */
async function findAvailableSlot(
  draft: BookingDraft,
  doctorId: string,
  start: string,
  ctx: BookingContext,
): Promise<TimeSlot | undefined> {
  const wanted = new Date(start).getTime();
  const slots = await ctx.tools.getDoctorAvailability({
    doctorId,
    specialtyId: draft.specialtyId,
    fromDate: manilaDateOf(start),
    days: 1,
  });
  return slots.find((slot) => new Date(slot.start).getTime() === wanted);
}

async function selectSlot(start: string, ctx: BookingContext): Promise<BookingReply> {
  const { draft } = ctx.state;
  const doctor = draft.doctorId ? await ctx.tools.getDoctor({ doctorId: draft.doctorId }) : null;
  if (!doctor) {
    return advance(
      { ...draft, doctorId: undefined, slotStart: undefined },
      ctx,
      BOOKING_COPY.doctorUnavailable,
    );
  }

  const slot = await findAvailableSlot(draft, doctor.id, start, ctx);
  if (!slot) {
    return offerSlots(doctor, draft, ctx, BOOKING_COPY.slotTaken);
  }

  let summaryDraft: BookingDraft = { ...draft, slotStart: slot.start };
  let charge: ChargeSummary | undefined;
  if (ctx.paymentEnabled) {
    const quote = await quoteConsultation(summaryDraft, doctor.id, ctx);
    if (!quote.ok) return quote.reply;
    charge = quote.charge;
    summaryDraft = quote.draft;
  }

  const specialty = await findSpecialty(ctx, draft.specialtyId);
  return {
    reply: BOOKING_COPY.confirmPrompt,
    payload: {
      kind: "booking_summary",
      doctorName: doctorDisplayName(doctor.fullName),
      specialtyName: specialty?.name ?? null,
      start: slot.start,
      end: slot.end,
      reason: draft.reason ?? null,
      ...(charge ? { charge } : {}),
    },
    state: { step: "awaiting_confirmation", draft: summaryDraft },
  };
}

type Quote =
  | {
      ok: true;
      charge: ChargeSummary;
      draft: BookingDraft;
      specialtyId: string;
      privilege: PrivilegeChoice;
      payment: PaymentChoice;
      hmoName: string | undefined;
    }
  | { ok: false; reply: BookingReply };

/**
 * PAY-03: the consultation's charge, computed from the fee in the database,
 * or the next question while the discount or payer is still missing. A fee
 * of null is "price on request" and cannot be booked in chat. An HMO that is
 * no longer active, or PhilHealth for an item with no PhilHealth benefit,
 * asks the payer question again.
 */
async function quoteConsultation(
  draft: BookingDraft,
  doctorId: string,
  ctx: BookingContext,
): Promise<Quote> {
  const { specialtyId, privilege } = draft;
  const fee = specialtyId ? await ctx.tools.getConsultationFee({ doctorId, specialtyId }) : null;
  if (!specialtyId || fee === null) {
    return {
      ok: false,
      reply: { reply: PAYMENT_COPY.priceOnRequest, payload: null, state: { step: "cancelled", draft: {} } },
    };
  }
  if (!privilege) {
    return {
      ok: false,
      reply: {
        reply: PAYMENT_COPY.privilegeQuestion,
        payload: { kind: "privilege_options" },
        state: { step: "choosing_privilege", draft },
      },
    };
  }

  const line = consultationLine(fee);
  const philhealthOffered = line.philhealthBenefitCentavos > 0;
  const hmoProviders = await ctx.tools.getActiveHmoProviders();
  let payment = draft.payment;
  let lead: string | undefined;
  if (payment?.payer === "philhealth" && !philhealthOffered) {
    payment = undefined;
  }
  const hmoChoice = payment?.payer === "hmo" ? payment : undefined;
  const hmo = hmoChoice
    ? hmoProviders.find((provider) => provider.id === hmoChoice.hmoProviderId)
    : undefined;
  if (hmoChoice && !hmo) {
    payment = undefined;
    lead = PAYMENT_COPY.hmoUnavailable;
  }
  if (!payment) {
    return {
      ok: false,
      reply: {
        reply: withLead(lead, PAYMENT_COPY.payerQuestion),
        payload: {
          kind: "payer_options",
          philhealth: philhealthOffered,
          hmoProviders: hmoProviders.map(({ id, name }) => ({ id, name })),
        },
        state: { step: "choosing_payer", draft: { ...draft, payment: undefined } },
      },
    };
  }

  const { totals } = computeCharge({
    items: [line],
    privilege,
    payer: payment.payer,
    hmoCopayCentavos: hmo?.copayCentavos ?? 0,
  });
  const payerLabel =
    payment.payer === "hmo" && hmo
      ? `${hmo.name} (member ${maskMemberNumber(payment.memberNumber)})`
      : paymentChoiceLabel(payment);
  return {
    ok: true,
    charge: { privilege, payerLabel, ...totals },
    draft: { ...draft, payment },
    specialtyId,
    privilege,
    payment,
    hmoName: hmo?.name,
  };
}

/** A failed booking shows the reason and fresh slots, never a confirmation. */
async function failBooking(
  doctor: DoctorSummary | null,
  draft: BookingDraft,
  ctx: BookingContext,
  message: string,
): Promise<BookingReply> {
  const cleared = { ...draft, slotStart: undefined };
  const next = doctor
    ? await offerSlots(doctor, cleared, ctx, message)
    : await advance({ ...cleared, doctorId: undefined }, ctx, message);
  return { ...next, state: { step: "failed", draft: next.state.draft } };
}

/**
 * Books only from awaiting_confirmation. The step is claimed first so a
 * second Confirm finds it taken, availability is re-checked, and the atomic
 * booking function plus the exclusion constraint are the final backstop.
 */
async function confirmBooking(ctx: BookingContext): Promise<BookingReply> {
  const { draft } = ctx.state;
  if (!(await ctx.claimBooking({ step: "booking", draft }))) {
    return { reply: BOOKING_COPY.alreadyProcessing, payload: null, state: ctx.state };
  }

  const doctor = draft.doctorId ? await ctx.tools.getDoctor({ doctorId: draft.doctorId }) : null;
  if (!doctor) {
    return failBooking(null, draft, ctx, BOOKING_COPY.doctorUnavailable);
  }
  const slot = draft.slotStart
    ? await findAvailableSlot(draft, doctor.id, draft.slotStart, ctx)
    : undefined;
  if (!slot) {
    return failBooking(doctor, draft, ctx, BOOKING_COPY.slotTaken);
  }

  if (ctx.paymentEnabled) {
    return confirmWithCharge(doctor, slot, draft, ctx);
  }

  const outcome = await ctx.tools.createAppointment({
    patientId: ctx.patientId,
    doctorId: doctor.id,
    start: slot.start,
    reason: draft.reason ?? null,
  });
  if (!outcome.ok) {
    return failBooking(doctor, draft, ctx, outcome.message);
  }

  return {
    reply: BOOKING_COPY.requested,
    payload: {
      kind: "booking_result",
      doctorName: doctorDisplayName(doctor.fullName),
      start: slot.start,
      end: slot.end,
    },
    state: { step: "booked", draft },
  };
}

/** The templated reply for a booking with a charge; amounts come from the payment row. */
function bookedPaymentReply(
  payment: BookedPayment,
  choice: PaymentChoice,
  hmoName: string | undefined,
  now: Date,
): string {
  if (payment.status === "hmo_pending") {
    return hmoPendingCopy(hmoName ?? "HMO");
  }
  if (payment.status === "awaiting_payment" && payment.deadline) {
    return paymentRequestCopy({
      amountDueCentavos: payment.amountDueCentavos,
      referenceCode: payment.referenceCode,
      deadline: payment.deadline,
      method: choice.payer === "self" ? choice.method : "qr_ph",
      now,
    });
  }
  return BOOKING_COPY.requested;
}

/**
 * PAY-03 Confirm: the charge is quoted again from the database and booked
 * with the appointment and payment in one transaction. The database
 * recomputes the amount and refuses if it differs from the summary.
 */
async function confirmWithCharge(
  doctor: DoctorSummary,
  slot: TimeSlot,
  draft: BookingDraft,
  ctx: BookingContext,
): Promise<BookingReply> {
  const quote = await quoteConsultation(draft, doctor.id, ctx);
  if (!quote.ok) {
    return quote.reply;
  }

  const outcome = await ctx.tools.createChargedAppointment({
    patientId: ctx.patientId,
    doctorId: doctor.id,
    specialtyId: quote.specialtyId,
    start: slot.start,
    reason: draft.reason ?? null,
    privilege: quote.privilege,
    payment: quote.payment,
    expectedAmountDueCentavos: quote.charge.amountDueCentavos,
  });
  if (!outcome.ok) {
    return failBooking(doctor, draft, ctx, outcome.message);
  }

  return {
    reply: bookedPaymentReply(outcome.payment, quote.payment, quote.hmoName, ctx.now),
    payload: {
      kind: "booking_result",
      doctorName: doctorDisplayName(doctor.fullName),
      start: slot.start,
      end: slot.end,
      payment: outcome.payment,
    },
    state: { step: "booked", draft },
  };
}

/** Saves a discount or payer answer and moves on from the slot, which is re-checked. */
function answerPaymentQuestion(
  changes: Pick<BookingDraft, "privilege" | "payment">,
  ctx: BookingContext,
): Promise<BookingReply> {
  const draft = { ...ctx.state.draft, ...changes };
  if (!draft.slotStart) {
    return Promise.resolve({ reply: BOOKING_COPY.outOfOrder, payload: null, state: ctx.state });
  }
  return selectSlot(draft.slotStart, { ...ctx, state: { ...ctx.state, draft } });
}

type LabelledReply = BookingReply & { label?: string };

async function selectSpecialty(specialtyId: string, ctx: BookingContext): Promise<LabelledReply> {
  const { state } = ctx;
  if (state.step === "choosing_doctor_specialty") {
    // Path B: the specialty must be one of the chosen doctor's, and the doctor stays.
    const doctor = state.draft.doctorId
      ? await ctx.tools.getDoctor({ doctorId: state.draft.doctorId })
      : null;
    const specialty = doctor?.specialties.find((entry) => entry.id === specialtyId);
    if (!doctor || !specialty) {
      return advance(state.draft, ctx, BOOKING_COPY.optionUnavailable);
    }
    const next = await offerSlots(doctor, { ...state.draft, specialtyId: specialty.id }, ctx);
    return { ...next, label: specialty.name };
  }

  const specialty = await findSpecialty(ctx, specialtyId);
  if (!specialty) {
    return advance(state.draft, ctx, BOOKING_COPY.optionUnavailable);
  }
  const next = await advance(applyCorrection(state.draft, { specialtyId: specialty.id }), ctx);
  return { ...next, label: specialty.name };
}

async function selectDoctor(doctorId: string, ctx: BookingContext): Promise<LabelledReply> {
  const doctor = await ctx.tools.getDoctor({ doctorId });
  if (!doctor) {
    return advance(ctx.state.draft, ctx, BOOKING_COPY.optionUnavailable);
  }
  const next = await advance(applyCorrection(ctx.state.draft, { doctorId: doctor.id }), ctx);
  return { ...next, label: doctorDisplayName(doctor.fullName) };
}

async function showLaterDates(fromDate: string, ctx: BookingContext): Promise<BookingReply> {
  const resolved = resolvePreferredDate(fromDate, ctx.now, ctx.horizonDays);
  switch (resolved.status) {
    case "ok":
      return advance(applyCorrection(ctx.state.draft, { preferredDate: resolved.date }), ctx);
    case "past":
      return { reply: BOOKING_COPY.dateInPast, payload: null, state: ctx.state };
    case "beyond_horizon":
      return { reply: beyondHorizonCopy(ctx.horizonDays), payload: null, state: ctx.state };
    case "invalid":
      return { reply: BOOKING_COPY.outOfOrder, payload: null, state: ctx.state };
  }
}

/** Edits the reason for visit and shows the summary again, with the slot re-checked. */
async function updateReason(reason: string, ctx: BookingContext): Promise<BookingReply> {
  const trimmed = clip(reason, BOOKING_REASON_MAX_LENGTH);
  const draft = { ...ctx.state.draft, reason: trimmed };
  if (!trimmed || !draft.slotStart) {
    return { reply: BOOKING_COPY.outOfOrder, payload: null, state: ctx.state };
  }
  return selectSlot(draft.slotStart, { ...ctx, state: { ...ctx.state, draft } });
}

function changeBooking(
  field: "specialty" | "doctor" | "slot" | "payment",
  ctx: BookingContext,
): Promise<BookingReply> {
  const { draft } = ctx.state;
  switch (field) {
    case "specialty":
      return askForSpecialty(draft, ctx);
    case "doctor":
      return advance({ ...draft, doctorId: undefined, slotStart: undefined }, ctx);
    case "slot":
      return advance({ ...draft, slotStart: undefined }, ctx);
    case "payment":
      return answerPaymentQuestion({ privilege: undefined, payment: undefined }, ctx);
  }
}

/**
 * Handles a booking card action. Events that would skip a step are refused
 * with the state unchanged; the user-side message text is written by the
 * server from database names, never taken from the client.
 */
export async function handleBookingEvent(
  event: BookingEvent,
  ctx: BookingContext,
): Promise<BookingReply & { userContent: string }> {
  const fallbackLabel = EVENT_LABELS[event.type];
  if (!acceptsEvent(ctx.state.step, event.type)) {
    return { reply: BOOKING_COPY.outOfOrder, payload: null, state: ctx.state, userContent: fallbackLabel };
  }

  switch (event.type) {
    case "select_specialty":
    case "select_doctor": {
      const { label, ...next } =
        event.type === "select_specialty"
          ? await selectSpecialty(event.specialtyId, ctx)
          : await selectDoctor(event.doctorId, ctx);
      return { ...next, userContent: label ?? fallbackLabel };
    }
    case "more_slots":
      return { ...(await showLaterDates(event.fromDate, ctx)), userContent: fallbackLabel };
    case "select_slot":
      return {
        ...(await selectSlot(event.start, ctx)),
        userContent: `${formatManilaShortDate(event.start)} · ${formatManilaTime(event.start)}`,
      };
    case "confirm_booking":
      return { ...(await confirmBooking(ctx)), userContent: fallbackLabel };
    case "change_booking":
      return {
        ...(await changeBooking(event.field, ctx)),
        userContent: CHANGE_LABELS[event.field],
      };
    case "update_reason":
      return { ...(await updateReason(event.reason, ctx)), userContent: fallbackLabel };
    case "select_privilege":
      return {
        ...(await answerPaymentQuestion({ privilege: event.privilege }, ctx)),
        userContent: PRIVILEGE_LABELS[event.privilege],
      };
    case "select_payer":
      return {
        ...(await answerPaymentQuestion({ payment: event.payment }, ctx)),
        userContent: paymentChoiceLabel(event.payment),
      };
    case "accept_booking_offer":
      return { ...(await routeBooking(ctx.state.draft, ctx)), userContent: fallbackLabel };
    case "cancel_booking":
      return {
        reply: BOOKING_COPY.stopped,
        payload: null,
        state: { step: "cancelled", draft: {} },
        userContent: fallbackLabel,
      };
  }
}
