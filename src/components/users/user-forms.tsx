"use client";

import Link from "next/link";

import { USER_ROLE_LABELS, USER_ROLES } from "@/lib/auth/roles";
import type { AdminUserDetail } from "@/lib/users/types";
import {
  changeUserRoleAction,
  sendPasswordResetAction,
  setUserActiveAction,
  updateUserProfileAction,
} from "@/server/users/actions";

import { FIELD_CLASS, Field, FormFooter } from "./form-parts";
import { useUserAdminForm } from "./use-user-admin-form";

const NOTE_CLASS = "text-sm text-ink-secondary";

function ReasonField({ id }: { id: string }) {
  return (
    <Field id={id} label="Reason">
      <textarea id={id} name="reason" required maxLength={500} rows={2} className={`${FIELD_CLASS} py-2`} />
    </Field>
  );
}

export function UserProfileForm({ user }: { user: AdminUserDetail }) {
  const { state, formAction, pending } = useUserAdminForm(updateUserProfileAction);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={user.id} />
      <Field id="profile-name" label="Full name">
        <input
          id="profile-name"
          name="fullName"
          type="text"
          required
          defaultValue={user.fullName}
          className={FIELD_CLASS}
        />
      </Field>
      <Field id="profile-phone" label="Phone">
        <input id="profile-phone" name="phone" type="tel" defaultValue={user.phone ?? ""} className={FIELD_CLASS} />
      </Field>
      <p className={NOTE_CLASS}>
        Email: <span className="font-medium text-ink">{user.email ?? "Not provided"}</span>. The account
        holder changes it through their own sign-in.
      </p>
      <FormFooter state={state} pending={pending} label="Save profile" />
    </form>
  );
}

export function UserRoleForm({ user, isSelf }: { user: AdminUserDetail; isSelf: boolean }) {
  const { state, formAction, pending } = useUserAdminForm(changeUserRoleAction);

  if (isSelf) {
    return (
      <p className={NOTE_CLASS}>
        You cannot change your own role. Ask another administrator.
      </p>
    );
  }
  if (user.hasDoctorRecord) {
    return (
      <p className={NOTE_CLASS}>
        This account has a doctor record. Manage it from{" "}
        <Link
          href="/admin/doctors"
          className="rounded font-medium text-primary underline underline-offset-4 focus-ring"
        >
          Doctors
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={user.id} />
      <Field id="role-select" label="Role">
        <select id="role-select" name="role" defaultValue={user.role} className={FIELD_CLASS}>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </Field>
      <ReasonField id="role-reason" />
      <FormFooter state={state} pending={pending} label="Change role" />
    </form>
  );
}

export function UserStatusForm({ user, isSelf }: { user: AdminUserDetail; isSelf: boolean }) {
  const { state, formAction, pending } = useUserAdminForm(setUserActiveAction);

  if (isSelf) {
    return (
      <p className={NOTE_CLASS}>
        You cannot deactivate your own account. Ask another administrator.
      </p>
    );
  }

  const nextActive = !user.isActive;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={user.id} />
      <input type="hidden" name="isActive" value={String(nextActive)} />
      <p className={NOTE_CLASS}>
        {user.isActive
          ? "A deactivated account cannot sign in or use any dashboard. Its history is kept."
          : "Activating restores sign-in and dashboard access."}
      </p>
      <ReasonField id="status-reason" />
      <FormFooter
        state={state}
        pending={pending}
        label={nextActive ? "Activate account" : "Deactivate account"}
        variant={nextActive ? "primary" : "outlineDanger"}
      />
    </form>
  );
}

export function PasswordResetForm({ user }: { user: AdminUserDetail }) {
  const { state, formAction, pending } = useUserAdminForm(sendPasswordResetAction);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="profileId" value={user.id} />
      <p className={NOTE_CLASS}>
        Supabase emails a link to {user.email ?? "the account's address"}. The account holder sets a
        new password themselves.
      </p>
      <FormFooter
        state={state}
        pending={pending}
        label="Send password reset email"
        pendingLabel="Sending…"
        variant="secondary"
      />
    </form>
  );
}
