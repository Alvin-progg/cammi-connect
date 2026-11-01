import "server-only";

import { z } from "zod";

import { matchDoctorsByName, filterSlotsByTime } from "@/lib/chat/resolve";
import { BOOKING_REASON_MAX_LENGTH } from "@/lib/chat/state";
import type { Department, DoctorSummary, Specialty } from "@/lib/directory/types";
import { bookAppointment, type AppointmentBooker } from "@/server/appointments/service";
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
 * booking is passed in by the orchestrator from the session.
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
};

export type ChatToolDeps = {
  directory: DirectoryStore;
  availability: AvailabilitySource;
  booker: AppointmentBooker;
  now: () => Date;
};

export function createChatTools({ directory, availability, booker, now }: ChatToolDeps): ChatTools {
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
      const [doctor] = await getAvailableSlots(
        { doctorId, specialtyId, fromDate, days, now: now() },
        availability,
      );
      return filterSlotsByTime(doctor?.slots ?? [], preferredTime);
    },

    async createAppointment(input) {
      const { patientId, doctorId, start, reason } = createAppointmentInputSchema.parse(input);
      return bookAppointment(
        { patientId, doctorId, scheduledAt: new Date(start), reason },
        booker,
      );
    },
  };
}
