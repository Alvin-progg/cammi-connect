"use client";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { Specialty } from "@/lib/directory/types";
import type { AppointmentRequirement } from "@/lib/requirements/types";
import type { HospitalService } from "@/lib/services/types";
import {
  saveRequirementAction,
  type RequirementActionState,
} from "@/server/requirements/actions";

const IDLE_STATE: RequirementActionState = { status: "idle" };

type TargetOption = { id: string; name: string; isActive: boolean };

/** Active options, plus the draft's own target if it was deactivated after it was chosen. */
function offered<Option extends TargetOption>(options: Option[], currentId: string | undefined) {
  return options.filter((option) => option.isActive || option.id === currentId);
}

function optionLabel(option: TargetOption): string {
  return option.isActive ? option.name : `${option.name} (inactive)`;
}

/**
 * Creates a draft requirement, or edits one. Published and archived
 * requirements are never edited; they are superseded or left as they are.
 */
export function RequirementForm({
  requirement,
  services,
  specialties,
  defaultTarget,
  today,
}: {
  requirement?: AppointmentRequirement;
  services: HospitalService[];
  specialties: Specialty[];
  /** "service:<id>" or "specialty:<id>" for a new requirement. */
  defaultTarget?: string | null;
  /** Manila "YYYY-MM-DD", the default start for a new requirement. */
  today: string;
}) {
  const { state, formAction, pending } = useAdminForm(saveRequirementAction, IDLE_STATE);
  const target = requirement?.target;
  const serviceOptions = offered(services, target?.kind === "service" ? target.id : undefined);
  const specialtyOptions = offered(
    specialties,
    target?.kind === "specialty" ? target.id : undefined,
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {requirement ? <input type="hidden" name="requirementId" value={requirement.id} /> : null}
      <Field id="requirement-title" label="Title">
        <input
          id="requirement-title"
          name="title"
          required
          maxLength={150}
          defaultValue={requirement?.title}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="requirement-description" label="Description">
        <textarea
          id="requirement-description"
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={requirement?.description ?? ""}
          className={`${FIELD_CLASS} py-2`}
        />
      </Field>
      <Field id="requirement-target" label="Applies to">
        <select
          id="requirement-target"
          name="target"
          required
          defaultValue={target ? `${target.kind}:${target.id}` : (defaultTarget ?? "")}
          className={FIELD_CLASS}
        >
          <option value="" disabled>
            Choose a service or specialty
          </option>
          <optgroup label="Services">
            {serviceOptions.map((service) => (
              <option key={service.id} value={`service:${service.id}`}>
                {optionLabel(service)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Specialties">
            {specialtyOptions.map((specialty) => (
              <option key={specialty.id} value={`specialty:${specialty.id}`}>
                {optionLabel(specialty)}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="requirement-effective-from" label="Effective from">
          <input
            id="requirement-effective-from"
            name="effectiveFrom"
            type="date"
            required
            defaultValue={requirement?.effectiveFrom ?? today}
            className={FIELD_CLASS}
          />
        </Field>
        <Field id="requirement-effective-to" label="Effective until (optional)">
          <input
            id="requirement-effective-to"
            name="effectiveTo"
            type="date"
            defaultValue={requirement?.effectiveTo ?? ""}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="isMandatory"
          defaultChecked={requirement?.isMandatory ?? true}
          className="size-4 accent-primary"
        />
        Mandatory
      </label>
      <FormFooter
        state={state}
        pending={pending}
        label={requirement ? "Save draft" : "Create draft"}
      />
    </form>
  );
}
