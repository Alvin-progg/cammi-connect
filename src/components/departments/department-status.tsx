"use client";

import { FormFooter } from "@/components/admin/form-parts";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments/status";
import type { Department } from "@/lib/directory/types";
import { setDepartmentActiveAction } from "@/server/departments/actions";

import { useDepartmentForm } from "./use-department-form";

/**
 * Activates or deactivates a department. A refused deactivation lists the
 * upcoming appointments that block it, so they can go to the front desk.
 */
export function DepartmentStatusForm({ department }: { department: Department }) {
  const { state, formAction, pending } = useDepartmentForm(setDepartmentActiveAction);
  const nextActive = !department.isActive;
  const conflicts = state.status === "error" ? (state.conflicts ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="departmentId" value={department.id} />
        <input type="hidden" name="isActive" value={String(nextActive)} />
        <p className="text-sm text-ink-secondary">
          {department.isActive
            ? "A deactivated department is hidden from booking. Its doctors and appointment history are kept."
            : "Activating makes the department available for booking again."}
        </p>
        <FormFooter
          state={state}
          pending={pending}
          label={nextActive ? "Activate department" : "Deactivate department"}
          variant={nextActive ? "primary" : "outlineDanger"}
        />
      </form>
      {conflicts.length > 0 ? (
        <ul aria-label="Blocking appointments" className="flex flex-col divide-y divide-line text-sm">
          {conflicts.map((conflict) => (
            <li key={conflict.appointmentId} className="flex flex-wrap gap-x-3 py-2">
              <span className="font-medium text-ink">{formatManilaDateTime(conflict.scheduledAt)}</span>
              <span className="text-ink-secondary">{conflict.doctorName}</span>
              <span className="text-ink-secondary">{APPOINTMENT_STATUS_LABELS[conflict.status]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
