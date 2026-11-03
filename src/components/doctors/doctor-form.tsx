"use client";

import { FIELD_CLASS, Field, FormFooter, LABEL_CLASS } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { Department, Specialty } from "@/lib/directory/types";
import type { AdminDoctorDetail, LinkableDoctorAccount } from "@/lib/doctors/types";
import { saveDoctorAction, type DoctorActionState } from "@/server/doctors/actions";

const IDLE_STATE: DoctorActionState = { status: "idle" };

/**
 * Creates a doctor, or edits one's name, department, specialties, contact, and
 * bio. Only active departments and specialties are offered, except the ones
 * the doctor already has, so editing never silently drops them. The linked
 * account is chosen on create only.
 */
export function DoctorForm({
  doctor,
  departments,
  specialties,
  linkableAccounts = [],
}: {
  doctor?: AdminDoctorDetail;
  departments: Department[];
  specialties: Specialty[];
  linkableAccounts?: LinkableDoctorAccount[];
}) {
  const { state, formAction, pending } = useAdminForm(saveDoctorAction, IDLE_STATE);
  const currentSpecialtyIds = new Set(doctor?.specialties.map((specialty) => specialty.id));
  const departmentOptions = departments.filter(
    (department) => department.isActive || department.id === doctor?.departmentId,
  );
  const specialtyOptions = specialties.filter(
    (specialty) => specialty.isActive || currentSpecialtyIds.has(specialty.id),
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {doctor ? <input type="hidden" name="doctorId" value={doctor.id} /> : null}
      <Field id="doctor-full-name" label="Full name">
        <input
          id="doctor-full-name"
          name="fullName"
          required
          minLength={2}
          maxLength={120}
          defaultValue={doctor?.fullName}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="doctor-department" label="Department">
        <select
          id="doctor-department"
          name="departmentId"
          required
          defaultValue={doctor?.departmentId ?? ""}
          className={FIELD_CLASS}
        >
          <option value="" disabled>
            Choose a department
          </option>
          {departmentOptions.map((department) => (
            <option key={department.id} value={department.id}>
              {department.isActive ? department.name : `${department.name} (inactive)`}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className={`${LABEL_CLASS} mb-1.5`}>Specialties</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {specialtyOptions.map((specialty) => (
            <label key={specialty.id} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="specialtyIds"
                value={specialty.id}
                defaultChecked={currentSpecialtyIds.has(specialty.id)}
                className="size-4 accent-primary"
              />
              {specialty.isActive ? specialty.name : `${specialty.name} (inactive)`}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="doctor-contact-email" label="Contact email">
        <input
          id="doctor-contact-email"
          name="contactEmail"
          type="email"
          maxLength={254}
          defaultValue={doctor?.contactEmail ?? ""}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="doctor-contact-phone" label="Contact phone">
        <input
          id="doctor-contact-phone"
          name="contactPhone"
          type="tel"
          maxLength={40}
          defaultValue={doctor?.contactPhone ?? ""}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="doctor-bio" label="Bio">
        <textarea
          id="doctor-bio"
          name="bio"
          maxLength={1000}
          rows={4}
          defaultValue={doctor?.bio ?? ""}
          className={`${FIELD_CLASS} py-2`}
        />
      </Field>
      {doctor ? null : (
        <Field id="doctor-account" label="Linked account">
          <select id="doctor-account" name="accountProfileId" defaultValue="" className={FIELD_CLASS}>
            <option value="">No login (directory only)</option>
            {linkableAccounts.map((account) => (
              <option key={account.profileId} value={account.profileId}>
                {account.fullName}
              </option>
            ))}
          </select>
        </Field>
      )}
      <p className="text-xs text-ink-muted">
        Contact details and bio are for hospital staff only; patients and Cami never see them.
      </p>
      <FormFooter state={state} pending={pending} label={doctor ? "Save doctor" : "Create doctor"} />
    </form>
  );
}
