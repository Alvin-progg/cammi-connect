"use client";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { centavosToPesoInput } from "@/lib/billing/money";
import type { Department } from "@/lib/directory/types";
import {
  SERVICE_BOOKING_MODES,
  SERVICE_BOOKING_MODE_LABELS,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  type HospitalService,
} from "@/lib/services/types";
import { saveServiceAction, type ServiceActionState } from "@/server/services/actions";

const IDLE_STATE: ServiceActionState = { status: "idle" };

const CHECKBOX_LABEL_CLASS = "flex min-h-11 items-center gap-2 text-sm text-ink";
const HINT_CLASS = "text-xs text-ink-muted";

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
      <fieldset className="flex flex-col gap-4 border-t border-line pt-4">
        <legend className="text-sm font-semibold text-ink">Pricing</legend>
        <Field id="service-category" label="Category">
          <select
            id="service-category"
            name="category"
            defaultValue={service?.category ?? "other"}
            className={FIELD_CLASS}
          >
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {SERVICE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="service-price" label="Price (₱)">
            <input
              id="service-price"
              name="price"
              inputMode="decimal"
              aria-describedby="service-price-help"
              defaultValue={centavosToPesoInput(service?.priceCentavos ?? null)}
              className={FIELD_CLASS}
            />
            <p id="service-price-help" className={HINT_CLASS}>
              Leave blank for &ldquo;price on request&rdquo;.
            </p>
          </Field>
          <Field id="service-philhealth" label="PhilHealth benefit (₱)">
            <input
              id="service-philhealth"
              name="philhealthBenefit"
              inputMode="decimal"
              aria-describedby="service-philhealth-help"
              defaultValue={centavosToPesoInput(service?.philhealthBenefitCentavos ?? 0)}
              className={FIELD_CLASS}
            />
            <p id="service-philhealth-help" className={HINT_CLASS}>
              Usually 0 unless the hospital is an accredited YAKAP provider.
            </p>
          </Field>
        </div>
        <Field id="service-daily-capacity" label="Daily capacity">
          <input
            id="service-daily-capacity"
            name="dailyCapacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            aria-describedby="service-daily-capacity-help"
            defaultValue={service?.dailyCapacity ?? ""}
            className={FIELD_CLASS}
          />
          <p id="service-daily-capacity-help" className={HINT_CLASS}>
            Walk-in patients per day. Leave blank for no limit.
          </p>
        </Field>
        <label className={CHECKBOX_LABEL_CLASS}>
          <input
            type="checkbox"
            name="vatable"
            defaultChecked={service?.vatable ?? false}
            className="size-4 accent-primary"
          />
          VAT-able
        </label>
        <label className={CHECKBOX_LABEL_CLASS}>
          <input
            type="checkbox"
            name="hmoCoverable"
            defaultChecked={service?.hmoCoverable ?? true}
            className="size-4 accent-primary"
          />
          HMO can cover it
        </label>
        <label className={CHECKBOX_LABEL_CLASS}>
          <input
            type="checkbox"
            name="requiresDoctorRequest"
            defaultChecked={service?.requiresDoctorRequest ?? false}
            className="size-4 accent-primary"
          />
          Needs a doctor&apos;s request
        </label>
      </fieldset>
      <FormFooter
        state={state}
        pending={pending}
        label={service ? "Save service" : "Create service"}
      />
    </form>
  );
}
