import "server-only";

import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseDoctorSchedulesRepository } from "@/server/schedules/repository";

import type { AvailabilitySource } from "./service";

export const supabaseAvailabilitySource: AvailabilitySource = {
  listSpecialties: () => supabaseDirectoryRepository.listSpecialties(),
  listDoctors: (filter) => supabaseDirectoryRepository.listDoctors(filter),
  getDoctor: (doctorId) => supabaseDirectoryRepository.getDoctor(doctorId),
  listSchedulesForDoctor: (doctorId) =>
    supabaseDoctorSchedulesRepository.listSchedulesForDoctor(doctorId),
  listExceptionsForDoctor: (input) =>
    supabaseDoctorSchedulesRepository.listExceptionsForDoctor(input),
  listActiveIntervals: (input) =>
    supabaseDoctorSchedulesRepository.listActiveIntervals(input),
};
