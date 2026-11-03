"use client";

import { FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { AdminDoctorListItem } from "@/lib/doctors/types";
import { setDoctorActiveAction, type DoctorActionState } from "@/server/doctors/actions";

const IDLE_STATE: DoctorActionState = { status: "idle" };

/**
 * Activates or deactivates a doctor. A refused deactivation lists the upcoming
 * appointments that block it, so they can go to the front desk.
 */
export function DoctorStatusForm({ doctor }: { doctor: AdminDoctorListItem }) {
  const { state, formAction, pending } = useAdminForm(setDoctorActiveAction, IDLE_STATE);
  const nextActive = !doctor.isActive;
  const conflicts = state.status === "error" ? (state.conflicts ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="doctorId" value={doctor.id} />
        <input type="hidden" name="isActive" value={String(nextActive)} />
        <p className="text-sm text-ink-secondary">
          {doctor.isActive
            ? "A deactivated doctor is hidden from booking and from Cami. Their appointment history is kept."
            : "Activating makes the doctor available for booking again."}
        </p>
        <FormFooter
          state={state}
          pending={pending}
          label={nextActive ? "Activate doctor" : "Deactivate doctor"}
          variant={nextActive ? "primary" : "outlineDanger"}
        />
      </form>
      {conflicts.length > 0 ? (
        <ul aria-label="Blocking appointments" className="flex flex-col divide-y divide-line text-sm">
          {conflicts.map((conflict) => (
            <li key={conflict.appointmentId} className="flex flex-wrap gap-x-3 py-2">
              <span className="font-medium text-ink">{formatManilaDateTime(conflict.scheduledAt)}</span>
              <span className="text-ink-secondary">{APPOINTMENT_STATUS_LABELS[conflict.status]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
