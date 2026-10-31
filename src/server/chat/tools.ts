import "server-only";

import { z } from "zod";

import { matchDoctorsByName } from "@/lib/chat/resolve";
import type { Department, DoctorSummary, Specialty } from "@/lib/directory/types";
import { listBookableDoctors, type DirectoryStore } from "@/server/directory/service";

const doctorDetailsInputSchema = z.object({
  doctorName: z.string().trim().min(1).max(200),
});

export type DoctorLookup =
  | { status: "found"; doctor: DoctorSummary }
  | { status: "several"; doctors: DoctorSummary[] }
  | { status: "unknown" };

/**
 * Database-backed tools the chat orchestrator may call. Doctors, departments,
 * and specialties shown to patients come only from here, never from the LLM
 * or RAG, and only active entries are returned.
 */
export type ChatTools = {
  getDepartments(): Promise<Department[]>;
  getSpecialties(): Promise<Specialty[]>;
  getDoctorDetails(input: { doctorName: string }): Promise<DoctorLookup>;
};

export function createChatTools(store: DirectoryStore): ChatTools {
  return {
    async getDepartments() {
      return (await store.listDepartments()).filter((department) => department.isActive);
    },

    async getSpecialties() {
      return (await store.listSpecialties()).filter((specialty) => specialty.isActive);
    },

    async getDoctorDetails(input) {
      const { doctorName } = doctorDetailsInputSchema.parse(input);
      const matches = matchDoctorsByName(doctorName, await listBookableDoctors({}, store));
      if (matches.length === 0) return { status: "unknown" };
      if (matches.length === 1) return { status: "found", doctor: matches[0] };
      return { status: "several", doctors: matches };
    },
  };
}
