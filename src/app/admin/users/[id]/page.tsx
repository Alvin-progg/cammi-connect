import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { TaskCard } from "@/components/users/form-parts";
import { UserActivity } from "@/components/users/user-activity";
import {
  PasswordResetForm,
  UserProfileForm,
  UserRoleForm,
  UserStatusForm,
} from "@/components/users/user-forms";
import { UserStatusBadge } from "@/components/users/users-list";
import { formatManilaDateTime } from "@/lib/appointments/format";
import { USER_ROLE_LABELS } from "@/lib/auth/roles";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseUserAdminRepository } from "@/server/users/repository";
import { getUserDetail } from "@/server/users/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Account" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const session = await getAdminSession(`/admin/users/${encodeURIComponent(id)}`);
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const profileId = z.uuid().safeParse(id);
  const detail = profileId.success
    ? await getUserDetail(profileId.data, supabaseUserAdminRepository)
    : null;
  if (!detail) {
    notFound();
  }

  const { user, activity } = detail;
  const isSelf = user.id === session.admin.id;

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="users"
      crumbs={[{ label: "Users", href: "/admin/users" }, { label: user.fullName }]}
    >
      <div className="flex flex-col gap-6">
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-ink-muted">Role</dt>
            <dd className="font-medium text-ink">{USER_ROLE_LABELS[user.role]}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-muted">Status</dt>
            <dd>
              <UserStatusBadge isActive={user.isActive} />
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-muted">Created</dt>
            <dd className="text-ink">{formatManilaDateTime(user.createdAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-muted">Last sign-in</dt>
            <dd className="text-ink">
              {user.lastSignInAt ? formatManilaDateTime(user.lastSignInAt) : "Never"}
            </dd>
          </div>
        </dl>

        <div className="grid gap-6 lg:grid-cols-2">
          <TaskCard title="Profile">
            <UserProfileForm user={user} />
          </TaskCard>
          <TaskCard title="Role" description="Every role change needs a reason and is recorded.">
            <UserRoleForm user={user} isSelf={isSelf} />
          </TaskCard>
          <TaskCard title="Status">
            <UserStatusForm user={user} isSelf={isSelf} />
          </TaskCard>
          <TaskCard title="Password">
            <PasswordResetForm user={user} />
          </TaskCard>
        </div>

        <TaskCard title="Recent activity" description="The last 20 recorded events.">
          <UserActivity userId={user.id} entries={activity} />
        </TaskCard>
      </div>
    </AdminShell>
  );
}
