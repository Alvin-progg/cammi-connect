"use client";

import { USER_ROLE_LABELS } from "@/lib/auth/roles";
import { STAFF_ROLES } from "@/lib/users/types";
import { inviteStaffAction } from "@/server/users/actions";

import { FIELD_CLASS, Field, FormFooter } from "@/components/admin/form-parts";
import { useUserAdminForm } from "./use-user-admin-form";

/**
 * Invites a staff member by email. Supabase sends the invitation and the
 * person sets their own password; the admin never sees it.
 */
export function InviteStaffForm() {
  const { state, formAction, pending } = useUserAdminForm(inviteStaffAction);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <Field id="invite-email" label="Email">
        <input id="invite-email" name="email" type="email" autoComplete="off" required className={FIELD_CLASS} />
      </Field>
      <Field id="invite-name" label="Full name">
        <input id="invite-name" name="fullName" type="text" autoComplete="off" required className={FIELD_CLASS} />
      </Field>
      <Field id="invite-role" label="Role">
        <select id="invite-role" name="role" defaultValue="front_desk" className={FIELD_CLASS}>
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="invite-phone" label="Phone (optional)">
        <input id="invite-phone" name="phone" type="tel" autoComplete="off" className={FIELD_CLASS} />
      </Field>
      <FormFooter state={state} pending={pending} label="Send invitation" pendingLabel="Sending…" />
    </form>
  );
}
