import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { buttonVariants } from "@/components/ui/button";
import { UsersFilters, UsersTable } from "@/components/users/users-list";
import { parseUserListFilters } from "@/lib/users/schemas";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseUserAdminRepository } from "@/server/users/repository";
import { listUsers } from "@/server/users/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const params = await searchParams;
  const session = await getAdminSession("/admin/users");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const filters = parseUserListFilters(params);
  const { users, total, page, pageCount } = await listUsers(filters, supabaseUserAdminRepository);

  return (
    <AdminShell adminName={session.admin.fullName} active="users" crumbs={[{ label: "Users" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <UsersFilters filters={filters} />
          <Link href="/admin/users/new" className={buttonVariants()}>
            Invite staff
          </Link>
        </div>
        <UsersTable users={users} total={total} page={page} pageCount={pageCount} filters={filters} />
      </div>
    </AdminShell>
  );
}
