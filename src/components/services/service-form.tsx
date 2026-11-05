"use client";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { Department } from "@/lib/directory/types";
import {
  SERVICE_BOOKING_MODES,
  SERVICE_BOOKING_MODE_LABELS,
  type HospitalService,
} from "@/lib/services/types";
import { saveServiceAction, type ServiceActionState } from "@/server/services/actions";

const IDLE_STATE: ServiceActionState = { status: "idle" };

/**
 * Creates a service, or edits one. Only active departments are offered, plus
 * the service's own department if it was deactivated after assignment (the
 * database lets a service keep it).
 */
export function ServiceForm({
  service,
  departments,
}: {
  service?: HospitalService;
  departments: Department[];
}) {
  const { state, formAction, pending } = useAdminForm(saveServiceAction, IDLE_STATE);
  const departmentOptions = departments.filter(
    (department) => department.isActive || department.id === service?.departmentId,
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}
      <Field id="service-name" label="Name">
        <input
          id="service-name"
          name="name"
          required
          maxLength={100}
          defaultValue={service?.name}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="service-description" label="Description">
        <textarea
          id="service-description"
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={service?.description ?? ""}
          className={`${FIELD_CLASS} py-2`}
        />
      </Field>
      <Field id="service-department" label="Department">
        <select
          id="service-department"
          name="departmentId"
          defaultValue={service?.departmentId ?? ""}
          className={FIELD_CLASS}
        >
          <option value="">No department</option>
          {departmentOptions.map((department) => (
            <option key={department.id} value={department.id}>
              {department.isActive ? department.name : `${department.name} (inactive)`}
            </option>
          ))}
        </select>
      </Field>
      <Field id="service-booking-mode" label="How patients access it">
        <select
          id="service-booking-mode"
          name="bookingMode"
          defaultValue={service?.bookingMode ?? "none"}
          className={FIELD_CLASS}
        >
          {SERVICE_BOOKING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {SERVICE_BOOKING_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="requiresAppointment"
          defaultChecked={service?.requiresAppointment ?? false}
          className="size-4 accent-primary"
        />
        Requires an appointment
      </label>
      <FormFooter
        state={state}
        pending={pending}
        label={service ? "Save service" : "Create service"}
      />
    </form>
  );
}
