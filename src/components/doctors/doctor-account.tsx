"use client";

import Link from "next/link";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useAdminForm } from "@/components/admin/use-admin-form";
import type { AdminDoctorListItem, LinkableDoctorAccount } from "@/lib/doctors/types";
import { linkDoctorAccountAction, type DoctorActionState } from "@/server/doctors/actions";

const IDLE_STATE: DoctorActionState = { status: "idle" };

/**
 * Shows whether the doctor can sign in, and lets an admin link an unlinked
 * doctor account to a directory-only doctor. Linking moves that account's
 * sign-in onto this doctor; there is no unlink.
 */
export function DoctorAccount({
  doctor,
  linkableAccounts,
}: {
  doctor: AdminDoctorListItem;
  linkableAccounts: LinkableDoctorAccount[];
}) {
  const { state, formAction, pending } = useAdminForm(linkDoctorAccountAction, IDLE_STATE);

  if (doctor.hasLogin) {
    return (
      <p className="text-sm text-ink-secondary">
        This doctor has a sign-in account and uses the doctor dashboard.
      </p>
    );
  }

  if (linkableAccounts.length === 0) {
    return (
      <p className="text-sm text-ink-secondary">
        This doctor has no login. Invite a doctor account at{" "}
        <Link
          href="/admin/users/new"
          className="rounded font-medium text-primary underline underline-offset-4 focus-ring"
        >
          Users
        </Link>
        , then link it here.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="doctorId" value={doctor.id} />
      <p className="text-sm text-ink-secondary">
        This doctor has no login. Link an invited doctor account so they can sign in. The account
        must not have any activity of its own.
      </p>
      <Field id="link-doctor-account" label="Doctor account">
        <select
          id="link-doctor-account"
          name="accountProfileId"
          required
          defaultValue=""
          className={FIELD_CLASS}
        >
          <option value="" disabled>
            Choose an account
          </option>
          {linkableAccounts.map((account) => (
            <option key={account.profileId} value={account.profileId}>
              {account.fullName}
            </option>
          ))}
        </select>
      </Field>
      <FormFooter state={state} pending={pending} label="Link account" pendingLabel="Linking…" />
    </form>
  );
}
