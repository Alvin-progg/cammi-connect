"use client";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import type { Department } from "@/lib/directory/types";
import { saveDepartmentAction } from "@/server/departments/actions";

import { useDepartmentForm } from "./use-department-form";

/** Creates a department, or edits one's name, code, and description. */
export function DepartmentForm({ department }: { department?: Department }) {
  const { state, formAction, pending } = useDepartmentForm(saveDepartmentAction);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {department ? <input type="hidden" name="departmentId" value={department.id} /> : null}
      <Field id="department-name" label="Name">
        <input
          id="department-name"
          name="name"
          required
          maxLength={100}
          defaultValue={department?.name}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="department-code" label="Code">
        <input
          id="department-code"
          name="code"
          required
          maxLength={10}
          defaultValue={department?.code}
          className={`${FIELD_CLASS} uppercase`}
        />
      </Field>
      <Field id="department-description" label="Description">
        <textarea
          id="department-description"
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={department?.description ?? ""}
          className={`${FIELD_CLASS} py-2`}
        />
      </Field>
      <FormFooter
        state={state}
        pending={pending}
        label={department ? "Save department" : "Create department"}
      />
    </form>
  );
}
