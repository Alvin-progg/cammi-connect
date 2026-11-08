import { EmptyState } from "@/components/ui/data";
import { CELL, HEADER_CELL, ROW, Table } from "@/components/ui/data";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { DoctorAppointmentRow } from "@/lib/doctors/types";

/** Read-only appointment history for one doctor. No patient data. */
export function DoctorAppointments({ appointments }: { appointments: DoctorAppointmentRow[] }) {
  if (appointments.length === 0) {
    return <EmptyState>No appointments yet.</EmptyState>;
  }

  return (
    <Table label="Appointment history" minWidthClass="min-w-[32rem]">
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>Date and time</th>
          <th scope="col" className={HEADER_CELL}>Specialty</th>
          <th scope="col" className={HEADER_CELL}>Status</th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((appointment) => (
          <tr key={appointment.appointmentId} className={ROW}>
            <td className={`${CELL} tabular-nums`}>{formatManilaDateTime(appointment.scheduledAt)}</td>
            <td className={CELL}>{appointment.specialtyName ?? "—"}</td>
            <td className={CELL}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
