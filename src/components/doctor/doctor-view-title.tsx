"use client";

import { usePathname } from "next/navigation";

import { DOCTOR_VIEW_LABELS, doctorViewForPath } from "@/lib/appointments/dashboard";

/** Header title for the current view, read from the URL because the header lives in the layout. */
export function DoctorViewTitle() {
  const view = doctorViewForPath(usePathname());
  return view === "week" ? "Appointments" : DOCTOR_VIEW_LABELS[view];
}
