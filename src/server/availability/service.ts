import "server-only";

import type { DoctorSummary } from "@/lib/directory/types";
import type { AvailabilityQuery } from "@/lib/schedules/schemas";
import { generateAvailableSlots } from "@/lib/schedules/slots";
import type { DirectoryStore } from "@/server/directory/service";
import type { DoctorSchedulesStore } from "@/server/schedules/service";

export type AvailabilitySource = Pick<
  DirectoryStore,
  "listSpecialties" | "listDoctors" | "getDoctor"
> &
  Pick<
    DoctorSchedulesStore,
    "listSchedulesForDoctor" | "listExceptionsForDoctor" | "listActiveIntervals"
  >;

/** Bookable slots per doctor. Only the doctor's name and slot times; no patient data. */
export type DoctorAvailability = {
  doctorId: string;
  doctorName: string;
  slots: { start: string; end: string }[];
};

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

async function resolveDoctors(
  query: AvailabilityQuery,
  source: AvailabilitySource,
): Promise<DoctorSummary[]> {
  if (query.specialtyId) {
    const specialties = await source.listSpecialties();
    const specialty = specialties.find((entry) => entry.id === query.specialtyId);
    if (!specialty?.isActive) {
      return [];
    }
  }

  if (query.doctorId) {
    const doctor = await source.getDoctor(query.doctorId);
    if (!doctor?.isActive) {
      return [];
    }
    if (
      query.specialtyId &&
      !doctor.specialties.some((specialty) => specialty.id === query.specialtyId)
    ) {
      return [];
    }
    return [doctor];
  }

  return source.listDoctors({ specialtyId: query.specialtyId, activeOnly: true });
}

/**
 * Authoritative availability for a doctor, or for every active doctor of a
 * specialty, over `days` Manila dates from `fromDate`. Slots come from the
 * doctors' schedules minus exceptions and active appointments. This is the
 * only source of availability; the chatbot must call it rather than assert
 * availability itself.
 */
export async function getAvailableSlots(
  query: AvailabilityQuery & { now: Date },
  source: AvailabilitySource,
): Promise<DoctorAvailability[]> {
  const doctors = await resolveDoctors(query, source);
  const windowStart = new Date(`${query.fromDate}T00:00:00+08:00`);
  const windowEnd = new Date(windowStart.getTime() + query.days * DAY_MILLISECONDS);
  const range = { start: windowStart.toISOString(), end: windowEnd.toISOString() };

  return Promise.all(
    doctors.map(async (doctor) => {
      const [schedules, exceptions, existing] = await Promise.all([
        source.listSchedulesForDoctor(doctor.id),
        source.listExceptionsForDoctor({ doctorId: doctor.id, ...range }),
        source.listActiveIntervals({ doctorId: doctor.id, ...range }),
      ]);

      const slots = generateAvailableSlots({
        doctorId: doctor.id,
        schedules,
        exceptions: exceptions.map((exception) => ({
          start: new Date(exception.startsAt),
          end: new Date(exception.endsAt),
        })),
        existing: existing.map((interval) => ({
          start: new Date(interval.start),
          end: new Date(interval.end),
        })),
        fromDate: query.fromDate,
        days: query.days,
        now: query.now,
      });

      return {
        doctorId: doctor.id,
        doctorName: doctor.fullName,
        slots: slots.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
        })),
      };
    }),
  );
}
