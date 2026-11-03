import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { DepartmentForm } from "@/components/departments/department-form";
import { getAdminSession } from "@/server/auth/dal";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "New department" };

export default async function AdminNewDepartmentPage() {
  const session = await getAdminSession("/admin/departments/new");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="departments"
      crumbs={[{ label: "Departments", href: "/admin/departments" }, { label: "New department" }]}
    >
      <DepartmentForm />
    </AdminShell>
  );
}
