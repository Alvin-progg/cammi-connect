"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import type {
  Department,
  DoctorSummary,
  LinkableAccount,
  Specialty,
} from "@/lib/directory/types";
import {
  saveDepartmentAction,
  saveDoctorAction,
  saveSpecialtyAction,
  type DirectoryActionState,
} from "@/server/directory/actions";

const IDLE_STATE: DirectoryActionState = { status: "idle" };

const FIELD_CLASS =
  "min-h-11 rounded-lg border border-control-line bg-surface px-3 text-sm text-ink placeholder:text-ink-muted focus-ring";
const LABEL_CLASS = "text-xs font-medium text-ink-muted";
const PRIMARY_BUTTON_CLASS =
  "focus-ring inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none";

/** Wires a directory form to its action: toast on success, reset when creating. */
function useDirectoryForm(
  action: (
    state: DirectoryActionState,
    formData: FormData,
  ) => Promise<DirectoryActionState>,
  resetOnSuccess: boolean,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      if (resetOnSuccess) {
        formRef.current?.reset();
      }
    }
  }, [state, resetOnSuccess]);

  return { formRef, state, formAction, pending };
}

function FormFooter({
  state,
  pending,
  label,
}: {
  state: DirectoryActionState;
  pending: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={PRIMARY_BUTTON_CLASS}
      >
        {pending ? "Saving…" : label}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-danger-soft-ink">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function ActiveCheckbox({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm text-ink-secondary">
      <input
        type="checkbox"
        name="isActive"
        defaultChecked={defaultChecked}
        className="size-4 accent-primary focus-ring"
      />
      Active
    </label>
  );
}

function inactiveSuffix(isActive: boolean): string {
  return isActive ? "" : " (inactive)";
}

export function DepartmentForm({ department }: { department?: Department }) {
  const { formRef, state, formAction, pending } = useDirectoryForm(
    saveDepartmentAction,
    !department,
  );
  const idPrefix = department ? `department-${department.id}` : "new-department";

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={department ? `Edit ${department.name}` : "Add department"}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      {department ? (
        <input type="hidden" name="departmentId" value={department.id} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_3fr_auto]">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-name`} className={LABEL_CLASS}>
            Name
          </label>
          <input
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={100}
            defaultValue={department?.name}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-code`} className={LABEL_CLASS}>
            Code
          </label>
          <input
            id={`${idPrefix}-code`}
            name="code"
            required
            maxLength={10}
            defaultValue={department?.code}
            className={`${FIELD_CLASS} uppercase`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-description`} className={LABEL_CLASS}>
            Description
          </label>
          <input
            id={`${idPrefix}-description`}
            name="description"
            maxLength={500}
            defaultValue={department?.description ?? ""}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex items-end">
          <ActiveCheckbox defaultChecked={department?.isActive ?? true} />
        </div>
      </div>
      <FormFooter
        state={state}
        pending={pending}
        label={department ? "Save" : "Add department"}
      />
    </form>
  );
}

export function SpecialtyForm({ specialty }: { specialty?: Specialty }) {
  const { formRef, state, formAction, pending } = useDirectoryForm(
    saveSpecialtyAction,
    !specialty,
  );
  const idPrefix = specialty ? `specialty-${specialty.id}` : "new-specialty";

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={specialty ? `Edit ${specialty.name}` : "Add specialty"}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      {specialty ? (
        <input type="hidden" name="specialtyId" value={specialty.id} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[2fr_3fr_auto]">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-name`} className={LABEL_CLASS}>
            Name
          </label>
          <input
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={100}
            defaultValue={specialty?.name}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-description`} className={LABEL_CLASS}>
            Description
          </label>
          <input
            id={`${idPrefix}-description`}
            name="description"
            maxLength={500}
            defaultValue={specialty?.description ?? ""}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex items-end">
          <ActiveCheckbox defaultChecked={specialty?.isActive ?? true} />
        </div>
      </div>
      <FormFooter
        state={state}
        pending={pending}
        label={specialty ? "Save" : "Add specialty"}
      />
    </form>
  );
}

/**
 * Create or edit a doctor. Inactive departments and specialties are offered
 * only when already assigned, so existing assignments stay visible but new
 * assignments go to active entries (the server enforces the same rule).
 */
export function DoctorForm({
  doctor,
  departments,
  specialties,
  linkableAccounts,
}: {
  doctor?: DoctorSummary;
  departments: Department[];
  specialties: Specialty[];
  linkableAccounts: LinkableAccount[];
}) {
  const { formRef, state, formAction, pending } = useDirectoryForm(
    saveDoctorAction,
    !doctor,
  );
  const idPrefix = doctor ? `doctor-${doctor.id}` : "new-doctor";
  const assignedSpecialtyIds = new Set(
    doctor?.specialties.map((specialty) => specialty.id) ?? [],
  );
  const departmentOptions = departments.filter(
    (department) => department.isActive || department.id === doctor?.departmentId,
  );
  const specialtyOptions = specialties.filter(
    (specialty) => specialty.isActive || assignedSpecialtyIds.has(specialty.id),
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={doctor ? `Edit ${doctor.fullName}` : "Add doctor"}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
    >
      {doctor ? <input type="hidden" name="doctorId" value={doctor.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-name`} className={LABEL_CLASS}>
            Full name
          </label>
          <input
            id={`${idPrefix}-name`}
            name="fullName"
            required
            minLength={2}
            maxLength={120}
            defaultValue={doctor?.fullName}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-department`} className={LABEL_CLASS}>
            Department
          </label>
          <select
            id={`${idPrefix}-department`}
            name="departmentId"
            defaultValue={doctor?.departmentId ?? ""}
            className={FIELD_CLASS}
          >
            <option value="">No department</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
                {inactiveSuffix(department.isActive)}
              </option>
            ))}
          </select>
        </div>
        {doctor ? null : (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idPrefix}-account`} className={LABEL_CLASS}>
              Login account
            </label>
            <select
              id={`${idPrefix}-account`}
              name="profileId"
              defaultValue=""
              className={FIELD_CLASS}
            >
              <option value="">No login (directory only)</option>
              {linkableAccounts.map((account) => (
                <option key={account.profileId} value={account.profileId}>
                  {account.fullName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={LABEL_CLASS}>Specialties</legend>
        {specialtyOptions.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Add an active specialty before adding doctors.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {specialtyOptions.map((specialty) => (
              <label
                key={specialty.id}
                className="flex min-h-11 items-center gap-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  name="specialtyIds"
                  value={specialty.id}
                  defaultChecked={assignedSpecialtyIds.has(specialty.id)}
                  className="size-4 accent-primary focus-ring"
                />
                {specialty.name}
                {inactiveSuffix(specialty.isActive)}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <ActiveCheckbox defaultChecked={doctor?.isActive ?? true} />
      <FormFooter state={state} pending={pending} label={doctor ? "Save" : "Add doctor"} />
    </form>
  );
}
