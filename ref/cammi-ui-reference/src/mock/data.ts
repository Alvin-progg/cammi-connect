/**
 * Synthetic data only (AGENTS.md non-negotiable). Names, numbers and IDs are
 * invented so the screens have something realistic to lay out.
 */
import type { AppointmentStatus } from "@/components/ui/badge";

export type Doctor = {
  id: string;
  name: string;
  initials: string;
  department: string;
  specialties: string[];
  nextOpen: string;
  linked: boolean;
  active: boolean;
  hasHours: boolean;
};

export const DOCTORS: Doctor[] = [
  { id: "doc-ar", name: "Dr. Ana Reyes", initials: "AR", department: "Pediatrics", specialties: ["General pediatrics"], nextOpen: "Mon, Nov 9 · 8:30 AM", linked: true, active: true, hasHours: true },
  { id: "doc-pm", name: "Dr. Paolo Mendoza", initials: "PM", department: "Pediatrics", specialties: ["Pediatric pulmonology"], nextOpen: "Wed, Nov 11 · 1:00 PM", linked: true, active: true, hasHours: true },
  { id: "doc-cv", name: "Dr. Carlo Villanueva", initials: "CV", department: "Internal medicine", specialties: ["Internal medicine", "Cardiology"], nextOpen: "Mon, Nov 9 · 2:30 PM", linked: true, active: true, hasHours: true },
  { id: "doc-gl", name: "Dr. Grace Lim", initials: "GL", department: "OB-GYN", specialties: ["Obstetrics", "Gynecology"], nextOpen: "Tue, Nov 10 · 9:00 AM", linked: true, active: true, hasHours: true },
  { id: "doc-rs", name: "Dr. Rico Salazar", initials: "RS", department: "Surgery", specialties: ["General surgery"], nextOpen: "—", linked: false, active: true, hasHours: false },
  { id: "doc-jl", name: "Dr. Joy Lim", initials: "JL", department: "Pediatrics", specialties: ["General pediatrics"], nextOpen: "—", linked: true, active: false, hasHours: false },
];

export type Appointment = {
  ref: string;
  patient: string;
  initials: string;
  doctor: string;
  department: string;
  when: string;
  time: string;
  source: "Chat" | "Front desk" | "Walk-in";
  status: AppointmentStatus;
  reason?: string;
  waiting?: string;
};

export const APPOINTMENTS: Appointment[] = [
  { ref: "APT-8A10-0401", patient: "Ella Navarro", initials: "EN", doctor: "Dr. Grace Lim", department: "OB-GYN", when: "Mon, Nov 9", time: "8:00 AM", source: "Chat", status: "no_show" },
  { ref: "APT-88A0-0402", patient: "Miguel Torres", initials: "MT", doctor: "Dr. Ana Reyes", department: "Pediatrics", when: "Mon, Nov 9", time: "8:30 AM", source: "Front desk", status: "checked_in" },
  { ref: "APT-80F4-0403", patient: "Celia Ramos", initials: "CR", doctor: "Dr. Grace Lim", department: "OB-GYN", when: "Mon, Nov 9", time: "9:00 AM", source: "Chat", status: "checked_in" },
  { ref: "REQ-7F3A-2210", patient: "Juan Dela Cruz", initials: "JD", doctor: "Dr. Ana Reyes", department: "Pediatrics", when: "Mon, Nov 9", time: "9:30 AM", source: "Chat", status: "requested", reason: "Cough for about a week", waiting: "18 h" },
  { ref: "APT-8B22-0405", patient: "Paolo Diaz", initials: "PD", doctor: "Dr. Carlo Villanueva", department: "Internal medicine", when: "Mon, Nov 9", time: "10:00 AM", source: "Chat", status: "confirmed" },
  { ref: "REQ-7F40-2211", patient: "Sofia Cruz", initials: "SC", doctor: "Dr. Ana Reyes", department: "Pediatrics", when: "Mon, Nov 9", time: "10:30 AM", source: "Chat", status: "requested", reason: "Follow-up check-up", waiting: "6 h" },
  { ref: "REQ-6C11-2198", patient: "Liza Bautista", initials: "LB", doctor: "Dr. Grace Lim", department: "OB-GYN", when: "Mon, Nov 9", time: "1:00 PM", source: "Chat", status: "requested", reason: "Prenatal check-up", waiting: "26 h" },
  { ref: "APT-91C2-0418", patient: "Teresa Lopez", initials: "TL", doctor: "Dr. Carlo Villanueva", department: "Internal medicine", when: "Mon, Nov 9", time: "2:00 PM", source: "Chat", status: "confirmed" },
  { ref: "REQ-5B90-2201", patient: "Ramon Aquino", initials: "RA", doctor: "Dr. Carlo Villanueva", department: "Internal medicine", when: "Tue, Nov 10", time: "10:00 AM", source: "Walk-in", status: "requested", reason: "Blood pressure check", waiting: "40 min" },
  { ref: "APT-77D2-0377", patient: "Andres Flores", initials: "AF", doctor: "Dr. Paolo Mendoza", department: "Pediatrics", when: "Tue, Nov 10", time: "1:30 PM", source: "Chat", status: "cancelled" },
  { ref: "APT-79B1-0385", patient: "Mario Cruz", initials: "MC", doctor: "Dr. Carlo Villanueva", department: "Internal medicine", when: "Fri, Nov 6", time: "3:00 PM", source: "Front desk", status: "completed" },
];

export const DEPARTMENTS = [
  { name: "Pediatrics", code: "PED", doctors: 4, appointments30d: 168, active: true },
  { name: "Internal medicine", code: "IM", doctors: 6, appointments30d: 151, active: true },
  { name: "OB-GYN", code: "OBG", doctors: 3, appointments30d: 122, active: true },
  { name: "Surgery", code: "SUR", doctors: 5, appointments30d: 78, active: true },
  { name: "ENT", code: "ENT", doctors: 2, appointments30d: 65, active: true },
  { name: "Dermatology", code: "DER", doctors: 0, appointments30d: 0, active: false },
];

export const SPECIALTIES = [
  { name: "General pediatrics", description: "Check-ups, vaccines and illness visits for children.", doctors: 3, active: true },
  { name: "Pediatric pulmonology", description: "Breathing problems, asthma and long coughs in children.", doctors: 1, active: true },
  { name: "Internal medicine", description: "Adult check-ups and ongoing conditions.", doctors: 5, active: true },
  { name: "Cardiology", description: "Heart and blood pressure care.", doctors: 2, active: true },
  { name: "Obstetrics", description: "Pregnancy and prenatal care.", doctors: 2, active: true },
  { name: "Gynecology", description: "Women's reproductive health.", doctors: 2, active: true },
  { name: "General surgery", description: "Consultations before and after surgery.", doctors: 4, active: true },
  { name: "Dermatology", description: "Skin, hair and nail conditions.", doctors: 0, active: false },
];

export const SERVICES = [
  { name: "Laboratory", department: "Laboratory", access: "Walk-in", requirements: 3, active: true },
  { name: "Pediatric consultation", department: "Pediatrics", access: "Appointment required", requirements: 1, active: true },
  { name: "Prenatal check-up", department: "OB-GYN", access: "Appointment required", requirements: 2, active: true },
  { name: "X-ray", department: "Radiology", access: "Walk-in with doctor's request", requirements: 2, active: true },
  { name: "Ultrasound", department: "Radiology", access: "Appointment required", requirements: 2, active: true },
  { name: "Physical therapy", department: "Rehabilitation", access: "Appointment required", requirements: 0, active: false },
];

export type RequirementStatus = "draft" | "published" | "archived";

export const REQUIREMENTS: { title: string; appliesTo: string; kind: "Service" | "Specialty"; mandatory: boolean; effective: string; status: RequirementStatus }[] = [
  { title: "Valid ID", appliesTo: "Laboratory", kind: "Service", mandatory: true, effective: "Since Jan 1, 2026", status: "published" },
  { title: "Doctor's laboratory request", appliesTo: "Laboratory", kind: "Service", mandatory: true, effective: "Since Oct 1, 2026", status: "published" },
  { title: "8–10 hour fasting", appliesTo: "Laboratory", kind: "Service", mandatory: true, effective: "From Nov 15, 2026", status: "draft" },
  { title: "Prenatal record booklet", appliesTo: "Obstetrics", kind: "Specialty", mandatory: true, effective: "Since Mar 1, 2026", status: "published" },
  { title: "Vaccination card", appliesTo: "General pediatrics", kind: "Specialty", mandatory: false, effective: "Since Jan 1, 2026", status: "published" },
  { title: "Old fasting rule (8 hours)", appliesTo: "Laboratory", kind: "Service", mandatory: true, effective: "Jan 1 – Nov 14, 2026", status: "archived" },
];

export const USERS = [
  { initials: "MS", name: "Maria Santos", email: "maria.santos@stcamillus.example", role: "Admin", active: true, last: "Now" },
  { initials: "RG", name: "Rosa Garcia", email: "rosa.garcia@stcamillus.example", role: "Front desk", active: true, last: "12 min ago" },
  { initials: "AR", name: "Dr. Ana Reyes", email: "ana.reyes@stcamillus.example", role: "Doctor", active: true, last: "1 h ago" },
  { initials: "CV", name: "Dr. Carlo Villanueva", email: "carlo.v@stcamillus.example", role: "Doctor", active: true, last: "Yesterday" },
  { initials: "LT", name: "Lea Tan", email: "lea.tan@stcamillus.example", role: "Front desk", active: true, last: "Invite sent" },
  { initials: "JD", name: "Juan Dela Cruz", email: "juan.delacruz@example.com", role: "Patient", active: true, last: "Nov 7" },
  { initials: "BO", name: "Ben Ocampo", email: "ben.ocampo@stcamillus.example", role: "Front desk", active: false, last: "Sep 30" },
];

/** The instructor's six analytics graphs (sample data from the activity PDF). */
export const ANALYTICS = {
  monthly: [82, 95, 108, 101, 125, 139, 132, 151, 144, 163, 157, 178].map((value, i) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
    value,
  })),
  byDoctor: [
    { doctor: "Dr. Carlo Villanueva", value: 115 },
    { doctor: "Dr. Ana Reyes", value: 96 },
    { doctor: "Dr. Rico Salazar", value: 89 },
    { doctor: "Dr. Paolo Mendoza", value: 72 },
    { doctor: "Dr. Grace Lim", value: 58 },
    { doctor: "Dr. Joy Lim", value: 43 },
  ],
  heatmap: {
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    slots: ["9–11 AM", "11 AM–1 PM", "1–3 PM", "3–5 PM"],
    values: [
      [18, 22, 15, 10],
      [24, 27, 18, 12],
      [20, 23, 16, 11],
      [26, 29, 19, 13],
      [17, 20, 14, 8],
    ],
  },
  outcomes: [
    { month: "Jan", completed: 65, cancelled: 10, noShow: 7 },
    { month: "Feb", completed: 76, cancelled: 11, noShow: 8 },
    { month: "Mar", completed: 86, cancelled: 13, noShow: 9 },
    { month: "Apr", completed: 80, cancelled: 12, noShow: 9 },
    { month: "May", completed: 101, cancelled: 14, noShow: 10 },
    { month: "Jun", completed: 113, cancelled: 15, noShow: 11 },
  ],
  ratesByWeekday: [
    { label: "Mon", cancelled: 8, noShow: 6 },
    { label: "Tue", cancelled: 10, noShow: 7 },
    { label: "Wed", cancelled: 7, noShow: 5 },
    { label: "Thu", cancelled: 12, noShow: 9 },
    { label: "Fri", cancelled: 15, noShow: 11 },
  ],
  ratesByDoctor: [
    { label: "Reyes", cancelled: 8, noShow: 5 },
    { label: "Mendoza", cancelled: 12, noShow: 9 },
    { label: "Villanueva", cancelled: 6, noShow: 4 },
    { label: "G. Lim", cancelled: 14, noShow: 10 },
    { label: "Salazar", cancelled: 9, noShow: 7 },
    { label: "J. Lim", cancelled: 11, noShow: 8 },
  ],
};
