import { z } from "zod";

import { parseRecordIdParam } from "@/lib/admin/dashboard";
import { isValidManilaDate, todayInManila } from "@/lib/appointments/filters";
import {
  PHONE_INVALID_MESSAGE,
  PHONE_MAX_LENGTH,
  PHONE_PATTERN,
} from "@/lib/profiles/schemas";

/** Staff-assisted booking (SPEC-frontdesk §7). */

export const PATIENT_SEARCH_MAX_LENGTH = 80;
export const PATIENT_SEARCH_LIMIT = 20;

/** A patient found by search. `hasAccount` is false for walk-in records. */
export type PatientMatch = {
  id: string;
  fullName: string;
  phone: string | null;
  hasAccount: boolean;
};

/** Shortest patient or appointment search; the ⌘K palette waits for it too. */
export const PATIENT_SEARCH_MIN_LENGTH = 2;

export const patientSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(
      PATIENT_SEARCH_MIN_LENGTH,
      `Enter at least ${PATIENT_SEARCH_MIN_LENGTH} characters of the name or phone number.`,
    )
    .max(PATIENT_SEARCH_MAX_LENGTH, "Keep the search under 80 characters."),
});

/**
 * A walk-in or phone-in patient registered by staff. The record has no
 * CamiConnect login, so the phone number is the way to reach them.
 */
export const registerPatientSchema = z.object({
  fullName: z
    .string({ error: "Enter the patient's full name." })
    .trim()
    .min(1, "Enter the patient's full name.")
    .max(120, "Keep the name under 120 characters."),
  phone: z
    .string({ error: PHONE_INVALID_MESSAGE })
    .trim()
    .max(PHONE_MAX_LENGTH, "Keep the phone number under 32 characters.")
    .regex(PHONE_PATTERN, PHONE_INVALID_MESSAGE),
});

export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;

/**
 * Canonical stored form of a walk-in patient's phone: separators removed, a
 * leading plus kept. Storing one form lets staff find a patient however the
 * number was typed, and lets registration refuse a duplicate number.
 */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s().-]/g, "");
}

/** Empty or missing optional text becomes null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null)
    .pipe(z.string().max(max, message).nullable());

export const frontDeskBookingSchema = z.object({
  patientId: z.uuid("Choose a patient."),
  doctorId: z.uuid("Choose a doctor."),
  specialtyId: z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null)
    .pipe(z.uuid("Choose a valid specialty.").nullable()),
  scheduledAt: z.iso.datetime({ offset: true, error: "Choose a time." }),
  reason: optionalText(500, "Keep the reason under 500 characters."),
});

export type FrontDeskBookingInput = z.infer<typeof frontDeskBookingSchema>;

type SearchParam = string | string[] | undefined;

function firstValue(value: SearchParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type BookingParams = {
  search: string | null;
  patientId: string | null;
  specialtyId: string | null;
  doctorId: string | null;
  date: string;
};

/** Reads the booking page's GET parameters; invalid values are dropped. */
export function parseBookingParams(
  params: {
    q?: SearchParam;
    patient?: SearchParam;
    specialty?: SearchParam;
    doctor?: SearchParam;
    date?: SearchParam;
  },
  now: Date = new Date(),
): BookingParams {
  const search = firstValue(params.q)?.trim().slice(0, PATIENT_SEARCH_MAX_LENGTH);
  const date = firstValue(params.date);

  return {
    search: search || null,
    patientId: parseRecordIdParam(params.patient),
    specialtyId: parseRecordIdParam(params.specialty),
    doctorId: parseRecordIdParam(params.doctor),
    date: date && isValidManilaDate(date) ? date : todayInManila(now),
  };
}
