import "server-only";

import type { PrivilegeChoice } from "@/lib/billing/compute";
import type { SlotInterval } from "@/lib/schedules/availability";
import {
  serviceSlots,
  walkInDates,
  type BookableService,
  type ServiceLoad,
  type ServicePeriod,
  type WalkInDate,
} from "@/lib/services/booking";
import type { BookedPayment } from "@/lib/chat/schemas";
import type { PaymentChoice } from "@/lib/chat/state";
import { BOOKING_REJECTION_MESSAGES, RAISED_EXCEPTION } from "@/server/appointments/service";
import { CHARGED_BOOKING_MESSAGES } from "@/server/payments/service";

/** A published requirement in effect, shown to the patient before payment. */
export type ServiceRequirement = {
  serviceId: string;
  title: string;
  description: string | null;
};

export type ServiceBookingInput = {
  patientId: string;
  /** In the patient's order; the first is the visit's service. */
  serviceIds: string[];
  /** Manila date of a walk-in visit; null for a scheduled one. */
  visitDate: string | null;
  /** Slot start of a scheduled visit; null for a walk-in one. */
  start: string | null;
  reason: string | null;
  privilege: PrivilegeChoice;
  payment: PaymentChoice;
  /** The amount on the summary the patient confirmed; the database refuses a mismatch. */
  expectedAmountDueCentavos: number;
};

export type ServiceBookingOutcome =
  | { ok: true; appointmentId: string; payment: BookedPayment }
  | { ok: false; message: string };

/**
 * PAY-07 data access. Services, hours, and prices are read live (not from the
 * reference cache) so what Cami shows is what cammi_connect_book_service
 * (0038) will check and charge.
 */
export type ServiceBookingStore = {
  listBookableServices(): Promise<BookableService[]>;
  listPeriods(serviceIds: string[]): Promise<ServicePeriod[]>;
  /** Hospital-wide holidays overlapping [from, to). */
  listHolidays(range: { from: Date; to: Date }): Promise<SlotInterval[]>;
  getLoad(input: { serviceIds: string[]; from: Date; to: Date }): Promise<ServiceLoad[]>;
  /** Published requirements in effect on `today` (Manila date). */
  listRequirements(serviceIds: string[], today: string): Promise<ServiceRequirement[]>;
  bookService(
    input: ServiceBookingInput,
  ): Promise<
    | { ok: true; appointmentId: string; payment: BookedPayment }
    | { ok: false; error: { code: string; message: string } }
  >;
};

export type ServiceTimes =
  | { mode: "walk_in"; dates: WalkInDate[] }
  | { mode: "scheduled"; slots: SlotInterval[] };

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

/**
 * Walk-in dates or scheduled slots for the chosen services over `days`
 * Manila dates from `fromDate`, starting after `earliestStart`. The first
 * service decides the mode (a valid selection never mixes them).
 */
export async function getServiceTimes(
  input: { services: BookableService[]; fromDate: string; days: number; earliestStart: Date },
  store: ServiceBookingStore,
): Promise<ServiceTimes> {
  const serviceIds = input.services.map((service) => service.id);
  const from = new Date(`${input.fromDate}T00:00:00+08:00`);
  const to = new Date(from.getTime() + input.days * DAY_MILLISECONDS);
  const [periods, holidays, load] = await Promise.all([
    store.listPeriods(serviceIds),
    store.listHolidays({ from, to }),
    store.getLoad({ serviceIds, from, to }),
  ]);
  const window = { holidays, fromDate: input.fromDate, days: input.days, now: input.earliestStart };

  const [primary] = input.services;
  if (primary?.bookingMode === "scheduled") {
    return {
      mode: "scheduled",
      slots: serviceSlots({
        ...window,
        periods: periods.filter((period) => period.serviceId === primary.id),
        load: load.filter((entry) => entry.serviceId === primary.id),
      }),
    };
  }
  return {
    mode: "walk_in",
    dates: walkInDates({
      ...window,
      load,
      services: input.services.map((service) => ({
        id: service.id,
        dailyCapacity: service.dailyCapacity,
        periods: periods.filter((period) => period.serviceId === service.id),
      })),
    }),
  };
}

/** Patient messages for the refusals 0038 adds; none names an amount. */
export const SERVICE_BOOKING_MESSAGES: Record<string, string> = {
  service_full: "That day is fully booked for one of your tests. Please choose another date.",
  slot_full: "That time was just booked. Please choose another time.",
  outside_hours: "The service isn't open at that time. Please choose another date or time.",
  blocked: "The hospital is closed that day. Please choose another date.",
  invalid_services: "Please choose the tests again.",
  service_unavailable: "One of the services isn't available for booking anymore.",
  invalid_service_combination: "Only lab tests can be booked together. Please book the others separately.",
  price_changed:
    "The price of one of your tests just changed. Please choose your date or time again to see the updated summary.",
  price_on_request:
    "One of the services is priced on request. Please contact the hospital front desk to book it.",
};

/**
 * Books a service visit as a `requested` appointment with its charge and
 * payment in one transaction. Known refusals become patient messages;
 * anything else throws without database details.
 */
export async function bookServiceWithCharge(
  input: ServiceBookingInput,
  store: ServiceBookingStore,
): Promise<ServiceBookingOutcome> {
  const result = await store.bookService(input);
  if (result.ok) {
    return result;
  }

  const { code, message } = result.error;
  if (code === RAISED_EXCEPTION) {
    for (const messages of [SERVICE_BOOKING_MESSAGES, CHARGED_BOOKING_MESSAGES, BOOKING_REJECTION_MESSAGES]) {
      if (Object.hasOwn(messages, message)) return { ok: false, message: messages[message] };
    }
  }
  throw new Error("Unable to book the service.");
}
