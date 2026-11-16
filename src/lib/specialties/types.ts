import type { Specialty } from "@/lib/directory/types";

export type SpecialtyOverview = Specialty & { doctorCount: number };

/** One specialty on its admin page, with its PAY-01 default consultation fee. */
export type SpecialtyDetail = Specialty & {
  /** Integer centavos; null when the hospital has not set it. */
  defaultConsultationFeeCentavos: number | null;
};
