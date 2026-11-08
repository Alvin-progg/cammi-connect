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

export type DoctorLookup =
  | { status: "found"; doctor: DoctorSummary }
  | { status: "several"; doctors: DoctorSummary[] }
  | { status: "unknown" };

export type TimeSlot = { start: string; end: string };

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
