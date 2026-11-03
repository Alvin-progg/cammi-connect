import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { DepartmentForm } from "@/components/admin/directory-forms";
import { EmptyState } from "@/components/admin/empty-state";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Departments" };

export default async function AdminDepartmentsPage() {
  const session = await getAdminSession("/admin/departments");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const departments = await supabaseDirectoryRepository.listDepartments();

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="departments"
      crumbs={[{ label: "Departments" }]}
    >
      <div className="flex flex-col gap-4">
        <DepartmentForm />
        {departments.length === 0 ? (
          <EmptyState>No departments yet.</EmptyState>
        ) : (
          departments.map((department) => (
            <DepartmentForm key={department.id} department={department} />
          ))
        )}
      </div>
    </AdminShell>
  );
}
