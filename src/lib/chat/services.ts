import { ROUTING_COPY } from "@/lib/chat/safety";
import type { ServiceKind } from "@/lib/services/booking";

/**
 * PAY-07 templated replies for lab, imaging, and package bookings. Service
 * names, times, requirements, and prices come from database rows; the LLM
 * writes none of this text.
 */
export const SERVICE_COPY = {
  askConcernOrService: `${ROUTING_COPY.askConcern} You can also book a lab test, imaging, or a check-up package below.`,
  chooseServices: {
    lab: "Which lab tests do you need? You can choose more than one.",
    diagnostics: "Which test would you like to book?",
    package: "Which check-up package would you like?",
  } satisfies Record<ServiceKind, string>,
  noServices: "Sorry, none of these can be booked in chat right now. Please contact the hospital front desk.",
  invalidCombination:
    "Only lab tests can be booked together in one visit. Please choose again, and book the others separately.",
  serviceUnavailable: "Sorry, that service isn't available for booking anymore.",
  walkInDates:
    "Lab tests and walk-in services are first come, first served during service hours. Which day will you come in?",
  noWalkInDates: "There are no open days in this period. You can look at later dates.",
  scheduledTimes: "Here are the available times. Choose the one that suits you.",
  noScheduledTimes: "There are no available times in this period. You can look at later dates.",
  requirementsLead: "Before you pay, please check what to prepare (shown below).",
  doctorRequest: "Doctor's request form",
  paymentOff:
    "Lab tests, imaging, and packages can't be booked in chat yet. Please contact the hospital front desk and they'll help you book.",
  requested:
    "All set! Your request has been received and is awaiting front desk confirmation. You'll see its status in My Appointments.",
} as const;
