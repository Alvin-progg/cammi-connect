import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { ServiceForm } from "@/components/services/service-form";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "New service" };

export default async function AdminNewServicePage() {
  const session = await getAdminSession("/admin/services/new");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const departments = await supabaseDirectoryRepository.listDepartments();

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="services"
      crumbs={[{ label: "Services", href: "/admin/services" }, { label: "New service" }]}
    >
      <ServiceForm departments={departments} />
    </AdminShell>
  );
}
