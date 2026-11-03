import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { SpecialtyForm } from "@/components/specialties/specialty-form";
import { getAdminSession } from "@/server/auth/dal";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "New specialty" };

export default async function AdminNewSpecialtyPage() {
  const session = await getAdminSession("/admin/specialties/new");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="specialties"
      crumbs={[{ label: "Specialties", href: "/admin/specialties" }, { label: "New specialty" }]}
    >
      <SpecialtyForm />
    </AdminShell>
  );
}
