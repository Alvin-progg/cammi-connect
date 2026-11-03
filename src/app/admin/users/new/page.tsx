import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { InviteStaffForm } from "@/components/users/invite-form";
import { getAdminSession } from "@/server/auth/dal";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Invite staff" };

export default async function AdminInviteStaffPage() {
  const session = await getAdminSession("/admin/users/new");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="users"
      crumbs={[{ label: "Users", href: "/admin/users" }, { label: "Invite staff" }]}
    >
      <div className="flex flex-col gap-4">
        <p className="max-w-2xl text-sm leading-6 text-ink-secondary">
          The person receives an email to set their own password. Patients register themselves and
          are not invited here.
        </p>
        <InviteStaffForm />
      </div>
    </AdminShell>
  );
}
