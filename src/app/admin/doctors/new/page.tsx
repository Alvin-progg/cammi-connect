import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { AccessDenied } from "@/components/auth/access-denied";
import { DoctorForm } from "@/components/doctors/doctor-form";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";
import { supabaseDoctorAdminRepository } from "@/server/doctors/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "New doctor" };

export default async function AdminNewDoctorPage() {
  const session = await getAdminSession("/admin/doctors/new");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const [departments, specialties, linkableAccounts] = await Promise.all([
    supabaseDirectoryRepository.listDepartments(),
    supabaseDirectoryRepository.listSpecialties(),
    supabaseDoctorAdminRepository.listLinkableAccounts(),
  ]);

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="doctors"
      crumbs={[{ label: "Doctors", href: "/admin/doctors" }, { label: "New doctor" }]}
    >
      <DoctorForm
        departments={departments}
        specialties={specialties}
        linkableAccounts={linkableAccounts}
      />
    </AdminShell>
  );
}
