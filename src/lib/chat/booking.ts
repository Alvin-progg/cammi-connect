import { MANILA_TIME_ZONE } from "@/lib/appointments/filters";

/**
 * Templated booking replies. The server writes every booking-step message;
 * the LLM never does (AI-APT-001 scope decision 1).
 */
export const BOOKING_COPY = {
  chooseSpecialty: "Which specialty would you like to book?",
  specialtyNotFound:
    "I couldn't find that specialty. Here are the specialties you can book:",
  severalSpecialties: "A few specialties match. Which one did you mean?",
  noSpecialties:
    "There are no specialties open for booking right now. Please contact the hospital directly.",
  doctorNotFound: "I couldn't find an active doctor with that name.",
  severalDoctors: "A few doctors match that name. Which one would you like to see?",
  doctorUnavailable: "That doctor isn't taking appointments right now.",
  optionUnavailable: "That option isn't available anymore.",
  slotTaken: "That time is no longer available.",
  confirmPrompt:
    "Please review your appointment request. Nothing is booked until you confirm.",
  requested:
    "Your appointment request has been received. It is awaiting the doctor's confirmation; you'll see its status in My Appointments.",
  alreadyProcessing:
    "This booking is already being processed. Please wait a moment before trying again.",
  outOfOrder:
    "That option isn't active anymore. Tell me what you'd like to book and we'll pick up from there.",
  stopped: "Okay, I've stopped this booking. Nothing was booked.",
  dateInPast: "That date has already passed. Which upcoming date would you prefer?",
  dateBeyondHorizon:
    "I can only book up to 60 days ahead. Please choose a date within the next 60 days.",
} as const;

/** Directory names may already carry the title (e.g. the seed's "Dr. Maya Santos"). */
export function doctorDisplayName(fullName: string): string {
  return /^dr\.?\s/i.test(fullName) ? fullName : `Dr. ${fullName}`;
}

const MANILA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: MANILA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Manila calendar date ("YYYY-MM-DD") of an ISO timestamp. */
export function manilaDateOf(isoTimestamp: string): string {
  return MANILA_DATE.format(new Date(isoTimestamp));
}

/** Groups slots by Manila date, keeping the order they arrive in. */
export function groupSlotsByManilaDate<T extends { start: string }>(
  slots: T[],
): { date: string; slots: T[] }[] {
  const days: { date: string; slots: T[] }[] = [];
  for (const slot of slots) {
    const date = manilaDateOf(slot.start);
    const day = days.at(-1);
    if (day?.date === date) {
      day.slots.push(slot);
    } else {
      days.push({ date, slots: [slot] });
    }
  }
  return days;
}
