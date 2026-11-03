import type { Metadata } from "next";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { DepartmentsTable } from "@/components/departments/departments-table";
import { buttonVariants } from "@/components/ui/button";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDepartmentAdminRepository } from "@/server/departments/repository";
import { listDepartmentsOverview } from "@/server/departments/service";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Departments" };

export default async function AdminDepartmentsPage() {
  const session = await getAdminSession("/admin/departments");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const departments = await listDepartmentsOverview(supabaseDepartmentAdminRepository);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="departments"
      crumbs={[{ label: "Departments" }]}
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Link href="/admin/departments/new" className={buttonVariants()}>
            New department
          </Link>
        </div>
        <DepartmentsTable departments={departments} />
      </div>
    </AdminShell>
  );
}
