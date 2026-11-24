import "server-only";

import { todayInManila } from "@/lib/appointments/filters";
import { BOOKING_COPY, groupSlotsByManilaDate, manilaDateOf } from "@/lib/chat/booking";
import { addDays, bookingHorizonEnd, matchSpecialtiesByName } from "@/lib/chat/resolve";
import type { IntentExtraction, ServiceRequirementView } from "@/lib/chat/schemas";
import { SERVICE_COPY } from "@/lib/chat/services";
import type { BookingDraft } from "@/lib/chat/state";
import {
  SERVICE_KINDS,
  serviceKindOf,
  serviceLine,
  validateServiceSelection,
  type BookableService,
  type ServiceKind,
} from "@/lib/services/booking";

import type { BookingContext, BookingReply } from "./booking";
import { bookedPaymentReply, quoteLines, withLead } from "./quote";
import type { TimeSlot } from "./tools";

/**
 * PAY-07: lab tests (multi-select), imaging and other diagnostics, and
 * packages, booked and paid in chat. Services, times, requirements, and
 * prices are re-read from the database on every step; card IDs and model
 * candidates are only matched against them.
 */

/** How many Manila dates one date or slot picker covers, as for doctors. */
const SLOT_WINDOW_DAYS = 7;
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

function inclusiveDaysBetween(from: string, to: string): number {
  const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(span / DAY_MILLISECONDS) + 1;
}

function serviceNames(services: BookableService[]): string[] {
  return services.map((service) => service.name);
}

/** Only bookable services, in the order given; anything else is dropped. */
async function resolveServices(ids: readonly string[], ctx: BookingContext): Promise<BookableService[]> {
  const bookable = await ctx.tools.getBookableServices();
  return ids.flatMap((id) => bookable.filter((service) => service.id === id));
}

/** A draft for a service visit: no doctor, specialty, or time yet. */
function serviceDraft(draft: BookingDraft, serviceIds?: string[]): BookingDraft {
  return { ...draft, serviceIds, doctorId: undefined, specialtyId: undefined, slotStart: undefined };
}

/** The "What kind?" groups that have at least one bookable service (payment.enabled only). */
export async function bookableServiceKinds(ctx: BookingContext): Promise<ServiceKind[]> {
  if (!ctx.paymentEnabled) return [];
  const services = await ctx.tools.getBookableServices();
  return SERVICE_KINDS.filter((kind) => services.some((service) => serviceKindOf(service.category) === kind));
}

/** Lists the bookable services of one kind; lab tests can be chosen together. */
export async function chooseServiceKind(
  kind: ServiceKind,
  ctx: BookingContext,
  lead?: string,
): Promise<BookingReply> {
  if (!ctx.paymentEnabled) {
    return { reply: SERVICE_COPY.paymentOff, payload: null, state: ctx.state };
  }
  const services = (await ctx.tools.getBookableServices()).filter(
    (service) => serviceKindOf(service.category) === kind,
  );
  if (services.length === 0) {
    return { reply: withLead(lead, SERVICE_COPY.noServices), payload: null, state: ctx.state };
  }
  return {
    reply: withLead(lead, SERVICE_COPY.chooseServices[kind]),
    payload: {
      kind: "service_options",
      multiple: kind === "lab",
      services: services.map(({ id, name, requiresDoctorRequest }) => ({ id, name, requiresDoctorRequest })),
    },
    state: { step: "choosing_services", draft: serviceDraft(ctx.state.draft) },
  };
}

/** Walk-in days or scheduled slots for one window from the preferred date. */
async function offerServiceTimes(
  services: BookableService[],
  draft: BookingDraft,
  ctx: BookingContext,
  lead?: string,
): Promise<BookingReply> {
  const today = todayInManila(ctx.now);
  const horizonEnd = bookingHorizonEnd(ctx.now, ctx.horizonDays);
  const fromDate = draft.preferredDate && draft.preferredDate > today ? draft.preferredDate : today;
  const days = Math.max(1, Math.min(SLOT_WINDOW_DAYS, inclusiveDaysBetween(fromDate, horizonEnd)));
  const nextFrom = addDays(fromDate, days);
  const { walkIn, slots } = await ctx.tools.getServiceTimes({
    serviceIds: services.map((service) => service.id),
    fromDate,
    days,
  });

  const reply = walkIn
    ? slots.length > 0
      ? SERVICE_COPY.walkInDates
      : SERVICE_COPY.noWalkInDates
    : slots.length > 0
      ? SERVICE_COPY.scheduledTimes
      : SERVICE_COPY.noScheduledTimes;
  return {
    reply: withLead(lead, reply),
    payload: {
      kind: "slot_picker",
      doctorName: serviceNames(services).join(" + "),
      walkIn,
      days: groupSlotsByManilaDate(slots),
      nextFromDate: nextFrom <= horizonEnd ? nextFrom : null,
      alternatives: [],
    },
    state: {
      step: "choosing_slot",
      draft: { ...draft, serviceIds: services.map((service) => service.id), slotStart: undefined },
    },
  };
}

/** Checks the chosen services together, then offers their dates or times. */
export async function chooseServices(serviceIds: string[], ctx: BookingContext): Promise<BookingReply> {
  const services = await resolveServices(serviceIds, ctx);
  if (services.length !== serviceIds.length || !validateServiceSelection(services)) {
    const kind = services[0] ? serviceKindOf(services[0].category) : "lab";
    const lead =
      services.length === serviceIds.length ? SERVICE_COPY.invalidCombination : SERVICE_COPY.serviceUnavailable;
    return chooseServiceKind(kind, ctx, lead);
  }
  return offerServiceTimes(services, serviceDraft(ctx.state.draft), ctx);
}

/** Resumes a service draft at its dates or times (later dates, change time, a failed booking). */
export async function resumeServiceBooking(
  draft: BookingDraft,
  ctx: BookingContext,
  lead?: string,
): Promise<BookingReply> {
  const serviceIds = draft.serviceIds ?? [];
  const services = await resolveServices(serviceIds, ctx);
  if (services.length === 0 || services.length !== serviceIds.length) {
    return chooseServiceKind(
      services[0] ? serviceKindOf(services[0].category) : "lab",
      ctx,
      withLead(lead, SERVICE_COPY.serviceUnavailable),
    );
  }
  return offerServiceTimes(services, draft, ctx, lead);
}

/** "Change the tests": the picker for the kind of the first chosen service. */
export async function changeServices(ctx: BookingContext): Promise<BookingReply> {
  const [first] = await resolveServices(ctx.state.draft.serviceIds ?? [], ctx);
  return chooseServiceKind(first ? serviceKindOf(first.category) : "lab", ctx);
}

/**
 * AI-APT-002 `serviceCandidates`: a candidate counts only when it names
 * exactly one bookable service, so the model can never invent one. Returns
 * null when nothing matched, and the caller routes the message as before.
 */
export async function startServiceBookingFromCandidates(
  extraction: IntentExtraction,
  draft: BookingDraft,
  ctx: BookingContext,
): Promise<BookingReply | null> {
  const candidates = extraction.serviceCandidates ?? [];
  if (candidates.length === 0) return null;
  const bookable = await ctx.tools.getBookableServices();
  const matched: BookableService[] = [];
  for (const candidate of candidates) {
    const matches = matchSpecialtiesByName(candidate, bookable);
    if (matches.length === 1 && !matched.includes(matches[0])) matched.push(matches[0]);
  }
  if (matched.length === 0) return null;
  if (!ctx.paymentEnabled) {
    return { reply: SERVICE_COPY.paymentOff, payload: null, state: ctx.state };
  }
  if (!validateServiceSelection(matched)) {
    return chooseServiceKind(serviceKindOf(matched[0].category), ctx, SERVICE_COPY.invalidCombination);
  }
  return offerServiceTimes(
    matched,
    serviceDraft(draft, matched.map((service) => service.id)),
    ctx,
  );
}

/** Published requirements, plus the doctor's request form where a service needs one and lists none. */
async function requirementViews(
  services: BookableService[],
  ctx: BookingContext,
): Promise<ServiceRequirementView[]> {
  const published = await ctx.tools.getServiceRequirements({
    serviceIds: services.map((service) => service.id),
  });
  return services.flatMap((service) => {
    const own = published.filter((requirement) => requirement.serviceId === service.id);
    if (own.length === 0 && service.requiresDoctorRequest) {
      return [{ serviceName: service.name, title: SERVICE_COPY.doctorRequest, description: null }];
    }
    return own.map(({ title, description }) => ({ serviceName: service.name, title, description }));
  });
}

/** The time, if the database still offers it; availability is re-read, never trusted from the card. */
async function findServiceTime(
  services: BookableService[],
  start: string,
  ctx: BookingContext,
): Promise<{ slot: TimeSlot; walkIn: boolean } | undefined> {
  const wanted = new Date(start).getTime();
  const { walkIn, slots } = await ctx.tools.getServiceTimes({
    serviceIds: services.map((service) => service.id),
    fromDate: manilaDateOf(start),
    days: 1,
  });
  const slot = slots.find((entry) => new Date(entry.start).getTime() === wanted);
  return slot ? { slot, walkIn } : undefined;
}

/**
 * A chosen date or time: requirements and the discount and payer questions
 * (PAY-03 reuse), then the summary with the breakdown.
 */
export async function selectServiceTime(start: string, ctx: BookingContext): Promise<BookingReply> {
  const { draft } = ctx.state;
  const services = await resolveServices(draft.serviceIds ?? [], ctx);
  if (services.length === 0 || services.length !== draft.serviceIds?.length) {
    return resumeServiceBooking(draft, ctx);
  }
  if (!ctx.paymentEnabled) {
    return { reply: SERVICE_COPY.paymentOff, payload: null, state: { step: "cancelled", draft: {} } };
  }
  const found = await findServiceTime(services, start, ctx);
  if (!found) {
    return offerServiceTimes(services, draft, ctx, BOOKING_COPY.slotTaken);
  }

  const requirements = await requirementViews(services, ctx);
  const quote = await quoteLines(
    services.map(serviceLine),
    { ...draft, slotStart: found.slot.start },
    ctx,
    requirements,
  );
  if (!quote.ok) return quote.reply;

  return {
    reply: BOOKING_COPY.confirmPrompt,
    payload: {
      kind: "booking_summary",
      doctorName: serviceNames(services).join(" + "),
      specialtyName: null,
      start: found.slot.start,
      end: found.slot.end,
      reason: draft.reason ?? null,
      charge: quote.charge,
      services: serviceNames(services),
      walkIn: found.walkIn,
      ...(requirements.length ? { requirements } : {}),
    },
    state: { step: "awaiting_confirmation", draft: quote.draft },
  };
}

async function failServiceBooking(
  draft: BookingDraft,
  ctx: BookingContext,
  message: string,
): Promise<BookingReply> {
  const next = await resumeServiceBooking({ ...draft, slotStart: undefined }, ctx, message);
  return { ...next, state: { step: "failed", draft: next.state.draft } };
}

/**
 * Confirm, after the booking step was claimed: the time and charge are
 * re-read and booked through cammi_connect_book_service, which writes the
 * visit, its charge and lines, and the payment in one transaction, so a
 * service visit is never left without a payment row.
 */
export async function confirmServiceBooking(draft: BookingDraft, ctx: BookingContext): Promise<BookingReply> {
  const services = await resolveServices(draft.serviceIds ?? [], ctx);
  if (services.length === 0 || services.length !== draft.serviceIds?.length) {
    return failServiceBooking(draft, ctx, SERVICE_COPY.serviceUnavailable);
  }
  if (!ctx.paymentEnabled) {
    return { reply: SERVICE_COPY.paymentOff, payload: null, state: { step: "cancelled", draft: {} } };
  }
  const found = draft.slotStart ? await findServiceTime(services, draft.slotStart, ctx) : undefined;
  if (!found) {
    return failServiceBooking(draft, ctx, BOOKING_COPY.slotTaken);
  }

  const quote = await quoteLines(services.map(serviceLine), draft, ctx, await requirementViews(services, ctx));
  if (!quote.ok) return quote.reply;

  const outcome = await ctx.tools.createServiceBooking({
    patientId: ctx.patientId,
    serviceIds: services.map((service) => service.id),
    visitDate: found.walkIn ? manilaDateOf(found.slot.start) : null,
    start: found.walkIn ? null : found.slot.start,
    reason: draft.reason ?? null,
    privilege: quote.privilege,
    payment: quote.payment,
    expectedAmountDueCentavos: quote.charge.amountDueCentavos,
  });
  if (!outcome.ok) {
    return failServiceBooking(draft, ctx, outcome.message);
  }

  return {
    reply: bookedPaymentReply(outcome.payment, quote.hmoName, ctx.now, SERVICE_COPY.requested),
    payload: {
      kind: "booking_result",
      doctorName: serviceNames(services).join(" + "),
      start: found.slot.start,
      end: found.slot.end,
      payment: outcome.payment,
      services: serviceNames(services),
      walkIn: found.walkIn,
    },
    state: { step: "booked", draft },
  };
}
