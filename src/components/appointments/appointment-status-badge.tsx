import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/lib/appointments/status";

const STATUS_TONES: Record<AppointmentStatus, string> = {
  requested: "border-warning/30 bg-warning-soft text-warning-soft-ink",
  confirmed: "border-success/30 bg-success-soft text-success-soft-ink",
  completed: "border-success/30 bg-success-soft text-success-soft-ink",
  cancelled: "border-danger/30 bg-danger-soft text-danger-soft-ink",
  no_show: "border-line bg-surface-muted text-ink-secondary",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONES[status]}`}
    >
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  );
}
