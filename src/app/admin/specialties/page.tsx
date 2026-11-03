import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { SpecialtyForm } from "@/components/admin/directory-forms";
import { EmptyState } from "@/components/admin/empty-state";
import { AccessDenied } from "@/components/auth/access-denied";
import { getAdminSession } from "@/server/auth/dal";
import { supabaseDirectoryRepository } from "@/server/directory/repository";

import { ADMIN_ACCESS_DENIED_MESSAGE } from "../_shared/placeholder-page";

export const instant = false;

export const metadata: Metadata = { title: "Specialties" };

export default async function AdminSpecialtiesPage() {
  const session = await getAdminSession("/admin/specialties");
  if (!session) {
    return <AccessDenied message={ADMIN_ACCESS_DENIED_MESSAGE} />;
  }

  const specialties = await supabaseDirectoryRepository.listSpecialties();

  return (
    <AdminShell
      adminName={session.admin.fullName}
      active="specialties"
      crumbs={[{ label: "Specialties" }]}
    >
      <div className="flex flex-col gap-4">
        <SpecialtyForm />
        {specialties.length === 0 ? (
          <EmptyState>No specialties yet.</EmptyState>
        ) : (
          specialties.map((specialty) => (
            <SpecialtyForm key={specialty.id} specialty={specialty} />
          ))
        )}
      </div>
    </AdminShell>
  );
}
