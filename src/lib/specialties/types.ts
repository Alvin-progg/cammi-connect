import type { Specialty } from "@/lib/directory/types";

export type SpecialtyOverview = Specialty & { doctorCount: number };
