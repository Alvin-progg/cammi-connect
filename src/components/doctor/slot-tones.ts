import type { AppointmentStatus } from "@/lib/appointments/status";

/**
 * Pastel status tints for the week grid. Text on top
 * always uses the ink tokens, so contrast does not depend on the tint.
 */
export const SLOT_TONES: Record<
  AppointmentStatus,
  { fill: string; edge: string }
> = {
  requested: {
    fill: "bg-slot-pending",
    edge: "border-slot-pending-edge",
  },
  confirmed: {
    fill: "bg-slot-confirmed",
    edge: "border-slot-confirmed-edge",
  },
  completed: {
    fill: "bg-slot-completed",
    edge: "border-slot-completed-edge",
  },
  cancelled: {
    fill: "bg-slot-cancelled",
    edge: "border-slot-cancelled-edge",
  },
  no_show: {
    fill: "bg-slot-noshow",
    edge: "border-slot-noshow-edge",
  },
};

export function patientInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "P";
}
