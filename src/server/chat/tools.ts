import "server-only";

import { z } from "zod";

import { splitPatientAppointments } from "@/lib/appointments/patient";
import type { PatientAppointment } from "@/lib/appointments/types";
import { matchDoctorsByName, filterSlotsByTime } from "@/lib/chat/resolve";
import { BOOKING_REASON_MAX_LENGTH } from "@/lib/chat/state";
import type { Department, DoctorSummary, Specialty } from "@/lib/directory/types";
import {
  bookAppointment,
  cancelAppointmentForPatient,
  listPatientAppointments,
  type AppointmentBooker,
  type PatientAppointmentRef,
  type PatientAppointmentsStore,
  type PatientCancelResult,
} from "@/server/appointments/service";
import { getAvailableSlots, type AvailabilitySource } from "@/server/availability/service";
import { listBookableDoctors, type DirectoryStore } from "@/server/directory/service";
import {
  bookConsultationWithCharge,
  type ChargedBookingInput,
  type ChargedBookingOutcome,
  type ChargeStore,
  type HmoOption,
} from "@/server/payments/service";
import { privilegeChoiceSchema } from "@/lib/billing/compute";
import { paymentChoiceSchema } from "@/lib/chat/state";

const doctorDetailsInputSchema = z.object({
  doctorName: z.string().trim().min(1).max(200),
});

const doctorIdInputSchema = z.object({ doctorId: z.uuid() });

const specialtyIdInputSchema = z.object({ specialtyId: z.uuid() });

const availabilityInputSchema = z.object({
  doctorId: z.uuid(),
  specialtyId: z.uuid().optional(),
  fromDate: z.iso.date(),
  // Matches availabilityQuerySchema's limit.
  days: z.number().int().min(1).max(14),
  preferredTime: z.string().max(50).optional(),
});

const patientIdInputSchema = z.object({ patientId: z.uuid() });

const patientAppointmentInputSchema = z.object({
  patientId: z.uuid(),
  appointmentId: z.uuid(),
});

const createAppointmentInputSchema = z.object({
  patientId: z.uuid(),
  doctorId: z.uuid(),
  start: z.iso.datetime({ offset: true }),
  reason: z.string().max(BOOKING_REASON_MAX_LENGTH).nullable(),
});

const consultationFeeInputSchema = z.object({ doctorId: z.uuid(), specialtyId: z.uuid() });

const chargedAppointmentInputSchema = createAppointmentInputSchema.extend({
  specialtyId: z.uuid(),
  privilege: privilegeChoiceSchema,
  payment: paymentChoiceSchema,
  expectedAmountDueCentavos: z.number().int().min(0),
});

export type DoctorLookup =
  | { status: "found"; doctor: DoctorSummary }
  | { status: "several"; doctors: DoctorSummary[] }
  | { status: "unknown" };

export type TimeSlot = { start: string; end: string };

/** An active specialty and whether any active doctor sees patients for it (AI-APT-002). */
export type RoutingSpecialty = Specialty & { hasActiveDoctors: boolean };

export type BookingOutcome = { ok: true; appointmentId: string } | { ok: false; message: string };

/**
 * Database-backed tools the chat orchestrator may call. Doctors, departments,
 * specialties, and slots shown to patients come only from here, never from
 * the LLM or RAG, and only active entries are returned. The patient ID for a
 * booking or an appointment lookup is passed in by the orchestrator from the
 * session, and every patient appointment query is scoped by it.
 */
export type ChatTools = {
  getDepartments(): Promise<Department[]>;
  getSpecialties(): Promise<Specialty[]>;
  getRoutableSpecialties(): Promise<RoutingSpecialty[]>;
  getDoctorDetails(input: { doctorName: string }): Promise<DoctorLookup>;
  getDoctor(input: { doctorId: string }): Promise<DoctorSummary | null>;
  getDoctorsBySpecialty(input: { specialtyId: string }): Promise<DoctorSummary[]>;
  getDoctorAvailability(input: {
    doctorId: string;
    specialtyId?: string;
    fromDate: string;
    days: number;
    preferredTime?: string;
  }): Promise<TimeSlot[]>;
  createAppointment(input: {
    patientId: string;
    doctorId: string;
    start: string;
    reason: string | null;
  }): Promise<BookingOutcome>;
  /** PAY-03: the doctor's own fee, else the specialty default; null is "price on request". */
  getConsultationFee(input: { doctorId: string; specialtyId: string }): Promise<number | null>;
  getActiveHmoProviders(): Promise<HmoOption[]>;
  /** PAY-03: books with a charge and payment in one transaction (payment.enabled only). */
  createChargedAppointment(input: ChargedBookingInput): Promise<ChargedBookingOutcome>;
  /** Upcoming requested or confirmed appointments, soonest first. */
  getPatientAppointments(input: { patientId: string }): Promise<PatientAppointment[]>;
  getPatientAppointment(input: {
    patientId: string;
    appointmentId: string;
  }): Promise<PatientAppointmentRef | null>;
  requestAppointmentCancellation(input: {
    patientId: string;
    appointmentId: string;
  }): Promise<PatientCancelResult>;
};

export type ChatToolDeps = {
  directory: DirectoryStore;
  availability: AvailabilitySource;
  booker: AppointmentBooker;
  patientAppointments: PatientAppointmentsStore;
  charges: ChargeStore;
  now: () => Date;
  /**
   * The admin's `appointment.min_lead_hours`. Cami offers, and so books, only
   * slots that start more than this many hours from now. Front desk booking
   * does not use these tools, so walk-ins are unaffected.
   */
  minLeadHours: () => Promise<number>;
};

const HOUR_MILLISECONDS = 60 * 60 * 1000;

export function createChatTools({
  directory,
  availability,
  booker,
  patientAppointments,
  charges,
  now,
  minLeadHours,
}: ChatToolDeps): ChatTools {
  return {
    async getDepartments() {
      return (await directory.listDepartments()).filter((department) => department.isActive);
    },

    async getSpecialties() {
      return (await directory.listSpecialties()).filter((specialty) => specialty.isActive);
    },

    async getRoutableSpecialties() {
      const [specialties, doctors] = await Promise.all([
        directory.listSpecialties(),
        listBookableDoctors({}, directory),
      ]);
      const staffed = new Set(
        doctors.flatMap((doctor) => doctor.specialties.map((specialty) => specialty.id)),
      );
      return specialties
        .filter((specialty) => specialty.isActive)
        .map((specialty) => ({ ...specialty, hasActiveDoctors: staffed.has(specialty.id) }));
    },

    async getDoctorDetails(input) {
      const { doctorName } = doctorDetailsInputSchema.parse(input);
      const matches = matchDoctorsByName(doctorName, await listBookableDoctors({}, directory));
      if (matches.length === 0) return { status: "unknown" };
      if (matches.length === 1) return { status: "found", doctor: matches[0] };
      return { status: "several", doctors: matches };
    },

    async getDoctor(input) {
      const { doctorId } = doctorIdInputSchema.parse(input);
      const doctor = await directory.getDoctor(doctorId);
      return doctor?.isActive ? doctor : null;
    },

    async getDoctorsBySpecialty(input) {
      const { specialtyId } = specialtyIdInputSchema.parse(input);
      return listBookableDoctors({ specialtyId }, directory);
    },

    async getDoctorAvailability(input) {
      const { doctorId, specialtyId, fromDate, days, preferredTime } =
        availabilityInputSchema.parse(input);
      const earliestStart = new Date(now().getTime() + (await minLeadHours()) * HOUR_MILLISECONDS);
      const [doctor] = await getAvailableSlots(
        { doctorId, specialtyId, fromDate, days, now: earliestStart },
        availability,
      );
      return filterSlotsByTime(doctor?.slots ?? [], preferredTime);
    },

    async createAppointment(input) {
      const { patientId, doctorId, start, reason } = createAppointmentInputSchema.parse(input);
      return bookAppointment(
        {
          patientId,
          doctorId,
          scheduledAt: new Date(start),
          reason,
          bookingSource: "ai_chatbot",
          createdByProfileId: patientId,
        },
        booker,
      );
    },

    async getConsultationFee(input) {
      return charges.getConsultationFee(consultationFeeInputSchema.parse(input));
    },

    async getActiveHmoProviders() {
      return charges.listActiveHmoProviders();
    },

    async createChargedAppointment(input) {
      return bookConsultationWithCharge(chargedAppointmentInputSchema.parse(input), charges);
    },

    async getPatientAppointments(input) {
      const { patientId } = patientIdInputSchema.parse(input);
      const appointments = await listPatientAppointments(patientId, patientAppointments);
      return splitPatientAppointments(appointments, now()).upcoming;
    },

    async getPatientAppointment(input) {
      return patientAppointments.getForPatient(patientAppointmentInputSchema.parse(input));
    },

    async requestAppointmentCancellation(input) {
      return cancelAppointmentForPatient(
        patientAppointmentInputSchema.parse(input),
        patientAppointments,
      );
    },
  };
}
